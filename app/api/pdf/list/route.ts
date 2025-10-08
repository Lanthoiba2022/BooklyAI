import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { ensureUserProvisioned } from "@/lib/user";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  console.log("[API] /api/pdf/list GET: start");
  // Get authenticated user
  const { user, headers } = await getAuthenticatedUserFromCookies(req);
  console.log("[API] /api/pdf/list GET: user", !!user, user?.id);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Ensure a corresponding row exists in our users table
  await ensureUserProvisioned(user as any);

  if (!supabaseServer) {
    return NextResponse.json({ files: [] });
  }
  try {
    // list files from user-specific folder
    const userFolder = `users/${user.id}`;

    if (!userFolder.startsWith(`users/${user.id}`)) {
      throw new Error("Invalid user folder access");
    }

    console.log("[API] /api/pdf/list GET: list storage", userFolder);
    const { data: storageList, error: listErr } = await supabaseServer.storage.from("pdfs").list(userFolder, { limit: 100, offset: 0, sortBy: { column: "name", order: "desc" } });
    if (listErr) throw listErr;

    // Join with pdfs table by storage_path when possible for status/page_count
    const paths = (storageList ?? []).map(f => `${userFolder}/${f.name}`);
    let metadataMap = new Map<string, { status: string | null; page_count: number | null }>();
    if (paths.length > 0) {
      const { data: pdfRows } = await supabaseServer
        .from('pdfs')
        .select('storage_path, status, page_count')
        .in('storage_path', paths);
      (pdfRows ?? []).forEach(r => metadataMap.set(r.storage_path, { status: r.status ?? null, page_count: r.page_count ?? null }));
    }

    // Batch-generate signed URLs to avoid N parallel calls and reduce latency
    let signedUrlMap = new Map<string, string | undefined>();
    if (paths.length > 0) {
      try {
        // @ts-ignore supabase-js v2 supports createSignedUrls
        console.log("[API] /api/pdf/list GET: batch signed URLs", paths.length);
        const { data: signedBatch } = await supabaseServer.storage.from("pdfs").createSignedUrls(paths, 60 * 60);
        (signedBatch ?? []).forEach((entry: any, idx: number) => {
          signedUrlMap.set(paths[idx]!, entry?.signedUrl);
        });
      } catch {
        // Fallback to per-file signed URLs on failure
        console.warn("[API] /api/pdf/list GET: batch failed, fallback per-file");
        for (const p of paths) {
          try {
            const { data } = await supabaseServer.storage.from("pdfs").createSignedUrl(p, 60 * 60);
            signedUrlMap.set(p, data?.signedUrl);
          } catch {
            signedUrlMap.set(p, undefined);
          }
        }
      }
    }

    // Construct response quickly; do not block on any stragglers
    const files = (storageList ?? []).map((f) => {
      const path = `${userFolder}/${f.name}`;
      const meta = metadataMap.get(path) ?? { status: null, page_count: null };
      return {
        id: path,
        name: f.name.replace(/^\d+_/, ""),
        path,
        url: signedUrlMap.get(path),
        status: meta.status,
        pageCount: meta.page_count,
      };
    });
    console.log("[API] /api/pdf/list GET: files built", files.length);
    const res = NextResponse.json({ files });
    headers.forEach((v, k) => res.headers.append(k, v));
    return res;
  } catch (e) {
    console.error("[API] /api/pdf/list GET: error", (e as any)?.message || e);
    return NextResponse.json({ files: [] });
  }
}


