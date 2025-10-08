import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

// Public routes that do not require authentication
const PUBLIC_PATHS = [
	"/signin",
	"/signup",
	"/auth/callback",
];

function isPublicPath(pathname: string): boolean {
	return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`/auth`));
}

function isAssetOrApiPath(pathname: string): boolean {
	if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return true;
	if (pathname.startsWith("/public") || pathname.startsWith("/assets")) return true;
	if (pathname.startsWith("/api")) return true; // do not block APIs here
	return false;
}

export function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// Skip for static assets and APIs
	if (isAssetOrApiPath(pathname)) {
		return NextResponse.next();
	}

	// Allow auth pages unauthenticated
	if (isPublicPath(pathname)) {
		return NextResponse.next();
	}

	// Validate Supabase session via HttpOnly cookies
	const res = NextResponse.next();
	const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
	if (!supabaseUrl || !supabaseAnonKey) return res;

  // First, try to decode access token locally to avoid any network calls
  try {
    const raw = req.cookies.get("sb-access-token")?.value
      || req.cookies.get("__Host-sb-access-token")?.value;
    if (raw) {
      const parts = raw.split(".");
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
        const payload = JSON.parse(payloadJson);
        if (payload?.sub) return res;
      }
    }
  } catch {}

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: (name: string) => req.cookies.get(name)?.value,
      set: (name: string, value: string, options: any) => {
        res.cookies.set({ name, value, ...options });
      },
      remove: (name: string, options: any) => {
        res.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  return supabase.auth.getUser().then(({ data }) => {
    if (data.user) return res;
    const signInUrl = new URL("/signin", req.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }).catch(() => res);
}

export const config = {
	matcher: [
		// Run on all routes except those explicitly excluded below
		"/(.*)",
	],
};


