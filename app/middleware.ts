import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Skip middleware for known routes
  if (
    path === '/' || 
    path.startsWith('/api/') ||
    path.startsWith('/parent') ||
    path.startsWith('/_next/') ||
    path.includes('.')
  ) {
    return NextResponse.next();
  }

  // For all other paths, treat them as potential kid slugs
  const slug = path.split('/')[1]; // Get first part after /
  if (slug) {
    const session = request.cookies.get('session')
    if (!session) {
      // Let the page handle public access
      return NextResponse.next()
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ]
} 