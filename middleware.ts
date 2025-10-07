import { NextResponse, NextRequest } from "next/server";

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

	// Check lightweight auth cookie set by client after Supabase login
	const hasAuthCookie = Boolean(req.cookies.get("bookly_auth")?.value);

	if (!hasAuthCookie) {
		const signInUrl = new URL("/signin", req.url);
		// Preserve intended destination
		signInUrl.searchParams.set("redirect", pathname);
		return NextResponse.redirect(signInUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		// Run on all routes except those explicitly excluded below
		"/(.*)",
	],
};


