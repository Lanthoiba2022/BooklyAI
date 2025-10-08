import { getEnv } from "./env";
import OpenAI from "openai";
import { supabaseServer } from "./supabaseServer";

export async function embedText(text: string): Promise<number[] | null> {
  const { openaiApiKey } = getEnv();
  if (!openaiApiKey) return null;
  const openai = new OpenAI({ apiKey: openaiApiKey });
  const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
  return res.data[0]?.embedding ?? null;
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


