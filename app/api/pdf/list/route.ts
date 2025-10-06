import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET() {
  if (!supabaseServer) {
    return NextResponse.json({ files: [] });
  }
  try {
    // list files from bucket root uploads/
    const { data, error } = await supabaseServer.storage.from("pdfs").list("uploads", { limit: 100, offset: 0, sortBy: { column: "name", order: "desc" } });
    if (error) throw error;
    const files = await Promise.all(
      (data ?? []).map(async (f) => {
        const path = `uploads/${f.name}`;
        const { data: urlData } = await supabaseServer.storage.from("pdfs").createSignedUrl(path, 60 * 60);
        return {
          id: path,
          name: f.name.replace(/^\d+_/, ""),
          path,
          url: urlData?.signedUrl,
        };
      })
    );
    return NextResponse.json({ files });
  } catch (e) {
    return NextResponse.json({ files: [] });
  }
}


