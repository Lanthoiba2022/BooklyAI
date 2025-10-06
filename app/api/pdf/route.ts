import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import crypto from "node:crypto";

export const runtime = "nodejs"; // ensure Node for file processing

export async function POST(req: NextRequest) {
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

  // Upload to Supabase Storage (bucket: pdfs)
  const arrayBuffer = await file.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  const originalName = (file as any).name ?? "upload.pdf";
  const sanitized = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}_${sanitized}`;
  const path = `uploads/${filename}`;

  const { data: uploadData, error: uploadError } = await supabaseServer.storage
    .from("pdfs")
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // TODO: insert `pdfs` row and enqueue extraction (Phase 2)
  return NextResponse.json({ ok: true, path: uploadData?.path });
}


