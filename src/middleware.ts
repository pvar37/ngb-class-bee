import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const url = request.nextUrl;

  // Check if the request is coming from the teacher subdomain
  if (host === 'teacher.nationalgeobee.org') {
    // If they hit the root of the subdomain, serve the teacher portal index
    if (url.pathname === '/') {
      return NextResponse.rewrite(new URL('/teacher', request.url));
    }

    // If they hit a sub-route (e.g., /dashboard), serve the corresponding teacher route
    if (!url.pathname.startsWith('/teacher') && !url.pathname.startsWith('/api')) {
      return NextResponse.rewrite(new URL(`/teacher${url.pathname}`, request.url));
    }
  }

  return NextResponse.next();
}

// Ensure middleware only runs on page routes, ignoring static files and images
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};