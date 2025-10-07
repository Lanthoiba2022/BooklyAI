import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import crypto from "node:crypto";

export const runtime = "nodejs"; // ensure Node for file processing

export async function POST(req: NextRequest) {
  // Get authenticated user via cookie-based session
  const { user, headers } = await getAuthenticatedUserFromCookies(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > 50) {
    return NextResponse.json({ error: "File exceeds 50MB limit" }, { status: 400 });
  }

  if (!supabaseServer) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  // Ensure bucket exists (create if missing)
  try {
    // List buckets then create if not found
    // @ts-ignore admin API available with service key
    const { data: buckets } = await (supabaseServer as any).storage.listBuckets();
    const exists = Array.isArray(buckets) && buckets.some((b: any) => b.name === "pdfs");
    if (!exists) {
      // @ts-ignore admin API
      await (supabaseServer as any).storage.createBucket("pdfs", {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024,
        allowedMimeTypes: ["application/pdf"],
      });
    }
  } catch (e) {
    // ignore – bucket may already exist
  }

  // Upload to Supabase Storage (bucket: pdfs) in user-specific folder
  const arrayBuffer = await file.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  const originalName = (file as any).name ?? "upload.pdf";
  const sanitized = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}_${sanitized}`;
  const path = `users/${user.id}/${filename}`;
  
  // Security check: ensure we're only uploading to the user's folder
  if (!path.startsWith(`users/${user.id}/`)) {
    return NextResponse.json({ error: "Invalid upload path" }, { status: 400 });
  }

  const { data: uploadData, error: uploadError } = await supabaseServer.storage
    .from("pdfs")
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // TODO: insert `pdfs` row and enqueue extraction (Phase 2)
  const res = NextResponse.json({ ok: true, path: uploadData?.path });
  // Propagate any updated auth cookies (e.g., refresh) from Supabase SSR
  headers.forEach((v, k) => res.headers.append(k, v));
  return res;
}

export async function DELETE(req: NextRequest) {
  // Authenticate user from cookies
  const { user, headers } = await getAuthenticatedUserFromCookies(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!supabaseServer) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => null);
    const path = body?.path as string | undefined;
    if (!path || typeof path !== "string") {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    // Ensure users can only delete within their own folder
    const userPrefix = `users/${user.id}/`;
    if (!path.startsWith(userPrefix)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabaseServer.storage.from("pdfs").remove([path]);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const res = NextResponse.json({ ok: true });
    headers.forEach((v, k) => res.headers.append(k, v));
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to delete" }, { status: 500 });
  }
}


