import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { ensureUserProvisioned } from "@/lib/user";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Get authenticated user
  const { user, headers } = await getAuthenticatedUserFromCookies(req);
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

    const files = await Promise.all(
      (storageList ?? []).map(async (f) => {
        const path = `${userFolder}/${f.name}`;
        const { data: urlData } = await supabaseServer.storage.from("pdfs").createSignedUrl(path, 60 * 60);
        const meta = metadataMap.get(path) ?? { status: null, page_count: null };
        return {
          id: path,
          name: f.name.replace(/^\d+_/, ""),
          path,
          url: urlData?.signedUrl,
          status: meta.status,
          pageCount: meta.page_count,
        };
      })
    );
    const res = NextResponse.json({ files });
    headers.forEach((v, k) => res.headers.append(k, v));
    return res;
  } catch (e) {
    console.error("Error listing user files:", e);
    return NextResponse.json({ files: [] });
  }
}


