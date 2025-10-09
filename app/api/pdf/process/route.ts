import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
// Import pdf-parse dynamically at runtime to avoid bundling issues and any
// accidental file system access during build.
let pdfParse: (data: Buffer) => Promise<{ text: string }>;
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

type Chunk = {
  page: number;
  text: string;
  line_start: number | null;
  line_end: number | null;
};

function chunkTextByPage(pages: string[]): Chunk[] {
  // Approximate ~2000 tokens per chunk using ~4 chars/token heuristic => ~8000 chars
  // Add an overlap to preserve context across chunks
  const maxLen = 8000;
  const overlap = 800;
  const chunks: Chunk[] = [];
  
  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    const pageText = pages[i] ?? "";
    
    // Split page by lines to track line numbers
    const lines = pageText.split('\n');
    let currentChunk = '';
    let lineStart = 0;
    let lineEnd = 0;
    
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx] + '\n';
      
      // If adding this line would exceed maxLen, finalize current chunk
      if (currentChunk.length + line.length > maxLen && currentChunk.length > 0) {
        chunks.push({ 
          page: pageNum, 
          text: currentChunk.trim(), 
          line_start: lineStart + 1, // 1-based line numbers
          line_end: lineEnd + 1 
        });
        
        // Start new chunk with overlap
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + line;
        lineStart = Math.max(0, lineEnd - Math.floor(overlap / 50)); // rough line overlap
        lineEnd = lineIdx;
      } else {
        currentChunk += line;
        lineEnd = lineIdx;
      }
    }
    
    // Add final chunk if there's remaining text
    if (currentChunk.trim().length > 0) {
      chunks.push({ 
        page: pageNum, 
        text: currentChunk.trim(), 
        line_start: lineStart + 1, 
        line_end: lineEnd + 1 
      });
    }
  }
  
  return chunks;
}

// Extract page texts using page-aware rendering; fall back to form-feed split
async function extractPages(buf: Buffer): Promise<string[]> {
  // Ensure module is loaded
  if (!pdfParse) {
    const mod = await import("pdf-parse/lib/pdf-parse.js");
    pdfParse = (mod as any).default ?? (mod as any);
  }

  // Try page-aware extraction using pagerender
  try {
    const pages: string[] = [];
    const mod = await import("pdf-parse/lib/pdf-parse.js");
    const pdfParseLocal: any = (mod as any).default ?? (mod as any);
    const options = {
      pagerender: async (pageData: any) => {
        const textContent = await pageData.getTextContent({
          normalizeWhitespace: false,
          disableCombineTextItems: false,
        });
        const strings = textContent.items.map((it: any) => (it.str ?? "")).filter(Boolean);
        const pageText = strings.join("\n");
        pages.push(pageText);
        return pageText;
      },
    } as any;

    // Execute pdf-parse which will invoke pagerender per page
    await pdfParseLocal(buf, options);
    if (pages.length > 0) return pages;
  } catch (e) {
    console.warn("[API] /api/pdf/process: pagerender extraction failed, falling back", e);
  }

  // Fallback: simple form-feed split
  const parsed = await pdfParse(buf);
  const ffPages = (parsed?.text || '').split('\f');
  return ffPages.length > 0 ? ffPages : [parsed?.text || ""];
}

export async function POST(req: NextRequest) {
  console.log("[API] /api/pdf/process POST: start");
  if (!supabaseServer) return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  const { geminiApiKey } = getEnv();
  if (!geminiApiKey) return NextResponse.json({ error: "GEMINI_API missing" }, { status: 500 });

  let pdfId: number | null = null;
  try {
    if (!pdfParse) {
      // Prefer direct ESM entry to avoid package resolution surprises
      const mod = await import("pdf-parse/lib/pdf-parse.js");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      pdfParse = (mod as any).default ?? (mod as any);
    }
    const body = await req.json();
    pdfId = body.pdfId;
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
      await supabaseServer.from('pdfs').update({ status: 'failed' }).eq('id', pdfId);
      return NextResponse.json({ error: dlErr?.message || 'Download failed' }, { status: 500 });
    }

    const buf = Buffer.from(await (fileData as any).arrayBuffer());
    if (!buf || buf.byteLength === 0) {
      console.error("[API] /api/pdf/process POST: empty file buffer");
      await supabaseServer.from('pdfs').update({ status: 'failed' }).eq('id', pdfId);
      return NextResponse.json({ error: 'Downloaded file was empty' }, { status: 500 });
    }
    
    const pages = await extractPages(buf);
    console.log("[API] /api/pdf/process POST: parsed pages", pages.length);

    const chunks = chunkTextByPage(pages);
    console.log("[API] /api/pdf/process POST: created chunks", chunks.length);

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    
    // Best-effort: clear previous chunks for this pdf
    await supabaseServer.from('chunks').delete().eq('pdf_id', pdfId);

    // Embed in batches with better error handling
    const batchSize = 32; // Reduced batch size for reliability
    const total = chunks.length;
    console.log("[API] /api/pdf/process POST: total chunks", total);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < total; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const input = batch.map(c => c.text);
      try {
        console.log("[API] /api/pdf/process POST: embedding batch", i / batchSize + 1, "of", Math.ceil(total / batchSize));
        const responses = await Promise.all(
          input.map(text => (embedModel as any).embedContent({
            content: { parts: [{ text }], role: 'user' },
            taskType: 'RETRIEVAL_DOCUMENT',
          }))
        );
        
        const rows = batch.map((c, idx) => {
          const embedding = (responses[idx] as any)?.embedding?.values;
          if (embedding && Array.isArray(embedding)) {
            console.log("[API] /api/pdf/process POST: embedding dimensions", embedding.length);
            // Truncate to 768 dimensions to fit PostgreSQL limits
            const truncatedEmbedding = embedding.slice(0, 768);
            console.log("[API] /api/pdf/process POST: truncated to", truncatedEmbedding.length, "dimensions");
            return {
              pdf_id: pdfId,
              page: c.page,
              line_start: c.line_start,
              line_end: c.line_end,
              text: c.text,
              embedding: truncatedEmbedding,
            };
          }
          return {
            pdf_id: pdfId,
            page: c.page,
            line_start: c.line_start,
            line_end: c.line_end,
            text: c.text,
            embedding: null,
          };
        });

        // Insert in smaller chunks to avoid payload limits
        const sliceSize = 50; // Reduced slice size
        for (let j = 0; j < rows.length; j += sliceSize) {
          const slice = rows.slice(j, j + sliceSize);
          const { error: insertErr } = await supabaseServer.from('chunks').insert(slice);
          if (insertErr) {
            console.error("[API] /api/pdf/process POST: insert error", insertErr.message);
            errorCount += slice.length;
          } else {
            successCount += slice.length;
          }
        }
      } catch (err: any) {
        console.error("[API] /api/pdf/process POST: embedding batch error", err?.message || err);
        errorCount += batch.length;
      }
    }

    console.log("[API] /api/pdf/process POST: embedding complete", { successCount, errorCount, total });

    // Update page_count and status based on success rate
    if (successCount > 0) {
      await supabaseServer.from('pdfs').update({ 
        page_count: pages.length, 
        status: errorCount > total * 0.5 ? 'partial' : 'ready' 
      }).eq('id', pdfId);
      console.log("[API] /api/pdf/process POST: ready", { pdfId, pages: pages.length, successCount, errorCount });
    } else {
      await supabaseServer.from('pdfs').update({ status: 'failed' }).eq('id', pdfId);
      console.error("[API] /api/pdf/process POST: failed - no embeddings created");
      return NextResponse.json({ error: 'Failed to create embeddings' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, chunks: successCount, pages: pages.length, errors: errorCount });
  } catch (e: any) {
    console.error("[API] /api/pdf/process POST: error", e?.message || e);
    if (pdfId) {
      await supabaseServer?.from('pdfs').update({ status: 'failed' }).eq('id', pdfId);
    }
    return NextResponse.json({ error: e?.message || 'Processing failed' }, { status: 500 });
  }
}


