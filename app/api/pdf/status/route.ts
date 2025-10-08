import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getAuthenticatedUserFromCookies } from "@/lib/auth-server";
import { ensureUserProvisioned } from "@/lib/user";

export async function GET(req: NextRequest) {
  const { user, headers } = await getAuthenticatedUserFromCookies(req);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const dbUser = await ensureUserProvisioned(user as any);

  const url = new URL(req.url);
  const pdfId = Number(url.searchParams.get('pdfId'));
  if (!pdfId) return NextResponse.json({ error: 'Missing pdfId' }, { status: 400 });

  if (!supabaseServer) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

  const { data, error } = await supabaseServer
    .from('pdfs')
    .select('id, status, page_count, owner_id')
    .eq('id', pdfId)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (dbUser && data.owner_id !== dbUser.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const res = NextResponse.json({ id: data.id, status: data.status, pageCount: data.page_count });
  headers.forEach((v, k) => res.headers.append(k, v));
  return res;
}


