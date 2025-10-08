import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { ensureUserProvisioned } from "@/lib/user";
import { embedText, searchChunks } from "@/lib/rag";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { user, headers } = await getAuthenticatedUserFromCookies(req);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const dbUser = await ensureUserProvisioned(user as any);

  const url = new URL(req.url);
  const pdfId = Number(url.searchParams.get('pdfId'));
  const q = url.searchParams.get('q') || '';
  if (!pdfId || !q) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  // Ownership check
  if (!supabaseServer) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  const { data: pdfRow } = await supabaseServer
    .from('pdfs')
    .select('id, owner_id')
    .eq('id', pdfId)
    .maybeSingle();
  if (!pdfRow || (dbUser && pdfRow.owner_id !== dbUser.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const emb = await embedText(q);
  if (!emb) return NextResponse.json({ error: 'Embedding failed' }, { status: 500 });

  const rows = await searchChunks(pdfId, emb, 5, 10);
  const res = NextResponse.json({ matches: rows });
  headers.forEach((v, k) => res.headers.append(k, v));
  return res;
}


