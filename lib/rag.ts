import { getEnv } from "./env";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseServer } from "./supabaseServer";

export async function embedText(text: string): Promise<number[] | null> {
  const { geminiApiKey } = getEnv();
  if (!geminiApiKey) return null;
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  try {
    const result = await (model as any).embedContent({
      content: { parts: [{ text }], role: 'user' },
      taskType: 'QUESTION_ANSWERING',
    });
    const embedding: number[] | undefined = (result as any)?.embedding?.values;
    return Array.isArray(embedding) ? embedding : null;
  } catch {
    return null;
  }
}

export async function searchChunks(pdfId: number, queryEmbedding: number[], k = 5, probes = 10) {
  if (!supabaseServer || !Array.isArray(queryEmbedding)) return [] as any[];
  const { data, error } = await supabaseServer.rpc('match_chunks', {
    p_pdf_id: pdfId,
    p_query: queryEmbedding,
    p_match_count: k,
    p_probes: probes,
  });
  if (error) return [];
  return data ?? [];
}

export type RetrievedChunk = {
  id: number;
  pdf_id: number;
  page: number;
  line_start: number | null;
  line_end: number | null;
  text: string;
  distance?: number;
};

export function buildPromptFromChunks(question: string, chunks: RetrievedChunk[]): { system: string; user: string; citations: Array<{ page: number; line_start: number | null; line_end: number | null; text: string }>; } {
  const top = chunks.slice(0, 5);
  const citations = top.map((c) => ({ page: c.page, line_start: c.line_start ?? null, line_end: c.line_end ?? null, text: c.text.slice(0, 280) }));
  const context = top.map((c, i) => `[#${i + 1} | page ${c.page}${c.line_start != null ? `, lines ${c.line_start}-${c.line_end ?? c.line_start}` : ''}] ${c.text}`).join("\n\n");
  const system = [
    "You are a helpful, concise tutor. Use the provided PDF context only.",
    "Cite page and lines inline like (p. 12, L 10-20). Do not fabricate citations.",
    "Prefer step-by-step clarity. If uncertain, say so briefly.",
  ].join(" \n");
  const user = [
    "Question:",
    question,
    "\n\nContext (numbered excerpts):\n",
    context,
    "\n\nInstructions: Answer concisely and cite pages/lines, e.g., (p. X, L a-b).",
  ].join(" ");
  return { system, user, citations };
}


