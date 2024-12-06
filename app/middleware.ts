import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Skip middleware for known routes and static files
  if (
    path === '/' || 
    path.startsWith('/api/') ||
    path.startsWith('/parent') ||
    path.startsWith('/_next/') ||
    path.includes('.') ||
    path === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // For all other paths, treat them as potential kid slugs
  const slug = path.split('/')[1]; // Get first part after /
  if (slug) {
    // Don't check session for kid pages - let the page handle access control
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip api routes and static files
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ]
} 