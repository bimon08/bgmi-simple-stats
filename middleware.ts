import { auth } from "@root/auth";
import { NextResponse } from "next/server";

/** Paths that don't require authentication */
const PUBLIC_PATHS = [
  "/login",
  "/pay",
  "/api/auth",
  "/api/pay",
  "/api/share",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Allow static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for authenticated session
  if (req.auth) {
    return NextResponse.next();
  }

  // Check for collaborator sync key cookie
  const collabKey = req.cookies.get("sc_collab_key")?.value;
  if (collabKey && /^[0-9a-f]{32}$/i.test(collabKey)) {
    return NextResponse.next();
  }

  // Redirect to login
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
