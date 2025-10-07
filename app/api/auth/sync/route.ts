import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

export async function POST(req: NextRequest) {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const headers = new Headers();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: (name: string) => req.cookies.get(name)?.value,
      set: (name: string, value: string, options: any) => {
        const cookie = serializeCookie(name, value, options);
        headers.append("set-cookie", cookie);
      },
      remove: (name: string, options: any) => {
        const cookie = serializeCookie(name, "", { ...options, maxAge: 0 });
        headers.append("set-cookie", cookie);
      },
    },
  });

  try {
    const body = await req.json();
    const access_token = body?.access_token as string | undefined;
    const refresh_token = body?.refresh_token as string | undefined;
    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
    }

    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true, user: data.user ?? null });
    headers.forEach((v, k) => res.headers.append(k, v));
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to sync" }, { status: 500 });
  }
}

function serializeCookie(name: string, value: string, options: any = {}): string {
  const enc = encodeURIComponent;
  let cookie = `${name}=${enc(value)}`;
  if (options.maxAge !== undefined) cookie += `; Max-Age=${Math.floor(options.maxAge)}`;
  if (options.domain) cookie += `; Domain=${options.domain}`;
  if (options.path) cookie += `; Path=${options.path}`;
  if (options.expires) cookie += `; Expires=${options.expires.toUTCString?.() ?? options.expires}`;
  if (options.httpOnly) cookie += `; HttpOnly`;
  if (options.secure) cookie += `; Secure`;
  if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
  return cookie;
}


