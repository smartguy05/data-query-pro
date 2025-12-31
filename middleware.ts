/**
 * Next.js Middleware for Route Protection
 *
 * Handles authentication checks for protected routes.
 * When MULTI_USER_ENABLED is false, all routes are accessible.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes that don't require authentication
const publicRoutes = ["/login", "/api/auth"];

// Routes that require admin role
const adminRoutes = ["/admin"];

// API routes that require admin role
const adminApiRoutes = [
  "/api/admin",
  "/api/schema/introspect",
  "/api/schema/start-introspection",
  "/api/schema/upload-schema",
  "/api/schema/generate-descriptions",
  "/api/schema/update-description",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if multi-user mode is enabled
  const multiUserEnabled = process.env.MULTI_USER_ENABLED === "true";

  // If multi-user mode is disabled, allow all requests
  if (!multiUserEnabled) {
    return NextResponse.next();
  }

  // Check if this is a public route
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check for static assets and other non-protected paths
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Get the session token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // If no token, redirect to login (for pages) or return 401 (for API)
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check admin routes
  const isAdminRoute = adminRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
  const isAdminApiRoute = adminApiRoutes.some(
    (route) => pathname === route || pathname.startsWith(route)
  );

  if ((isAdminRoute || isAdminApiRoute) && token.role !== "admin") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Forbidden", message: "Admin access required" },
        { status: 403 }
      );
    }

    // Redirect non-admin users to home
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Add user info to request headers for API routes
  const response = NextResponse.next();

  if (pathname.startsWith("/api/")) {
    response.headers.set("x-user-id", token.id as string);
    response.headers.set("x-user-role", token.role as string);
    response.headers.set("x-user-email", token.email as string);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
