import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/assessment", "/profile", "/results"];

const guestOnlyRoutes = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const accessToken = request.cookies.get("access_token");

  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  const isGuestOnlyRoute = guestOnlyRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  /*
   * Protected routes
   */
  if (isProtectedRoute && !accessToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  /*
   * Guest-only routes
   */
  if (isGuestOnlyRoute && accessToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/assessment/:path*",
    "/profile/:path*",
    "/results/:path*",
    "/login",
    "/register",
  ],
};
