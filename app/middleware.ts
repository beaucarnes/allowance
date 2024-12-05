import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Check for session cookie on /kids route
  if (request.nextUrl.pathname === '/kids' || request.nextUrl.pathname.startsWith('/kids/')) {
    const session = request.cookies.get('session')
    
    if (!session) {
      // If accessing /kids directly, redirect to login
      if (request.nextUrl.pathname === '/kids') {
        return NextResponse.redirect(new URL('/parent', request.url))
      }
      
      // For specific kid pages, continue to let the page handle public access
      if (request.nextUrl.pathname.startsWith('/kids/')) {
        return NextResponse.next()
      }
    }
  }
}

export const config = {
  matcher: ['/kids', '/kids/:path*']
} 