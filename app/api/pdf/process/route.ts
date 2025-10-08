import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
// Import pdf-parse dynamically at runtime to avoid bundling issues and any
// accidental file system access during build.
let pdfParse: (data: Buffer) => Promise<{ text: string }>; 
import OpenAI from "openai";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

type Chunk = {
  page: number;
  text: string;
  line_start: number | null;
  line_end: number | null;
};

function chunkTextByPage(pages: string[]): Chunk[] {
  const maxLen = 1100;
  const overlap = 150;
  const chunks: Chunk[] = [];
  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    const pageText = pages[i] ?? "";
    let start = 0;
    while (start < pageText.length) {
      const end = Math.min(start + maxLen, pageText.length);
      const slice = pageText.slice(start, end);
      chunks.push({ page: pageNum, text: slice, line_start: null, line_end: null });
      if (end >= pageText.length) break;
      start = Math.max(0, end - overlap);
    }
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  console.log("[API] /api/pdf/process POST: start");
  if (!supabaseServer) return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  const { openaiApiKey } = getEnv();
  if (!openaiApiKey) return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

  try {
    if (!pdfParse) {
      const mod = await import("pdf-parse");
      // default export contains the function
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      pdfParse = (mod as any).default ?? (mod as any);
    }
    const { pdfId } = await req.json();
    console.log("[API] /api/pdf/process POST: payload", pdfId);
    if (!pdfId || typeof pdfId !== 'number') {
      return NextResponse.json({ error: "Missing pdfId" }, { status: 400 });
    }

    // Atomically set status to 'processing' if currently 'pending'
    const { data: pdfRow, error: pdfErr } = await supabaseServer
      .from('pdfs')
      .update({ status: 'processing' })
      .eq('id', pdfId)
      .eq('status', 'pending')
      .select('id, storage_path, status')
      .maybeSingle();
    if (pdfErr) {
      console.error("[API] /api/pdf/process POST: status update error", pdfErr.message);
      return NextResponse.json({ error: pdfErr.message }, { status: 500 });
    }
    if (!pdfRow) {
      // Already processing or ready; exit fast
      console.log("[API] /api/pdf/process POST: already processing/ready, skip");
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Download file from storage
    console.log("[API] /api/pdf/process POST: download", pdfRow.storage_path);
    const { data: fileData, error: dlErr } = await supabaseServer
      .storage
      .from('pdfs')
      .download(pdfRow.storage_path);
    if (dlErr || !fileData) {
      console.error("[API] /api/pdf/process POST: download error", dlErr?.message);
      return NextResponse.json({ error: dlErr?.message || 'Download failed' }, { status: 500 });
    }

    const buf = Buffer.from(await fileData.arrayBuffer());
    const parsed = await pdfParse(buf);
    // pdf-parse returns combined text; attempt page split via metadata if available
    const pages = (parsed?.text || '').split('\f');

    const chunks = chunkTextByPage(pages);

    const openai = new OpenAI({ apiKey: openaiApiKey });
    // Embed in batches
    const batchSize = 64;
    const total = chunks.length;
    console.log("[API] /api/pdf/process POST: total chunks", total);

    // Best-effort: clear previous chunks for this pdf
    await supabaseServer.from('chunks').delete().eq('pdf_id', pdfId);

    for (let i = 0; i < total; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const input = batch.map(c => c.text);
      try {
        const emb = await openai.embeddings.create({ model: 'text-embedding-3-small', input });
        const rows = batch.map((c, idx) => ({
          pdf_id: pdfId,
          page: c.page,
          line_start: c.line_start,
          line_end: c.line_end,
          text: c.text,
          embedding: emb.data[idx]?.embedding ?? null,
        }));
        // Insert in smaller chunks to avoid payload limits
        const sliceSize = 100;
        for (let j = 0; j < rows.length; j += sliceSize) {
          await supabaseServer.from('chunks').insert(rows.slice(j, j + sliceSize));
        }
      } catch (err: any) {
        console.error("[API] /api/pdf/process POST: embedding batch error", err?.message || err);
      }
    }

    // Update page_count and status
    await supabaseServer.from('pdfs').update({ page_count: pages.length, status: 'ready' }).eq('id', pdfId);
    console.log("[API] /api/pdf/process POST: ready", { pdfId, pages: pages.length });

    return NextResponse.json({ ok: true, chunks: chunks.length, pages: pages.length });
  } catch (e: any) {
    console.error("[API] /api/pdf/process POST: error", e?.message || e);
    return NextResponse.json({ error: e?.message || 'Processing failed' }, { status: 500 });
  }
}


