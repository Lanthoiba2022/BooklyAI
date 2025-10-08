import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnv } from "./env";

const { supabaseUrl, supabaseAnonKey } = getPublicEnv();

type UserResult = { user: any | null; headers: Headers };

// Read Supabase session from HttpOnly cookies and return stable user.id
export async function getAuthenticatedUserFromCookies(req: NextRequest): Promise<UserResult> {
  const headers = new Headers();
  if (!supabaseUrl || !supabaseAnonKey) return { user: null, headers };

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: (name: string) => req.cookies.get(name)?.value,
      set: (name: string, value: string, options: any) => {
        // Accumulate Set-Cookie headers for caller to attach to response
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
    const { data: { user } } = await supabase.auth.getUser();
    return { user: user ?? null, headers };
  } catch {
    // Fallback: decode Supabase access token from cookies to avoid network call issues (e.g., TLS errors on Windows)
    try {
      const token = req.cookies.get("sb-access-token")?.value;
      if (!token) return { user: null, headers };
      const parts = token.split(".");
      if (parts.length !== 3) return { user: null, headers };
      const payloadJson = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
      const payload = JSON.parse(payloadJson);
      const user = payload?.sub ? { id: payload.sub, email: payload.email ?? null, user_metadata: payload.user_metadata ?? null } : null;
      return { user, headers };
    } catch {
      return { user: null, headers };
    }
  }
}

// Minimal cookie serializer; mirrors set-cookie semantics used by @supabase/ssr
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

