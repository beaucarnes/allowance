import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminAuth } from './lib/firebase-admin-app'
import { getFirestore } from 'firebase-admin/firestore'

export async function middleware(request: NextRequest) {
  // If accessing a specific kid's page
  if (request.nextUrl.pathname.startsWith('/kids/')) {
    const session = request.cookies.get('session')

    // If no session, check if kid is public
    if (!session) {
      const slug = request.nextUrl.pathname.split('/')[2]
      const db = getFirestore()
      const kidsSnapshot = await db.collection('kids')
        .where('slug', '==', slug)
        .get()

      if (!kidsSnapshot.empty) {
        const kid = kidsSnapshot.docs[0].data()
        // If kid is not public and no session, redirect to login
        if (!kid.public) {
          return NextResponse.redirect(new URL('/parent', request.url))
        }
      }
    }
  }
}

export const config = {
  matcher: ['/kids/:path*'],
} 