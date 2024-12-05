import { NextResponse } from 'next/server'
import { getAdminAuth } from '@/app/lib/firebase-admin-app'

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json()
    console.log('Creating/refreshing session...')
    
    const auth = getAdminAuth()
    const expiresIn = 60 * 60 * 24 * 5 // 5 days in seconds
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn })

    const response = NextResponse.json({ status: 'success' })
    
    response.cookies.set({
      name: 'session',
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: expiresIn,
    })

    console.log('Session cookie set/refreshed')
    return response
  } catch (error) {
    console.error('Session creation error:', error)
    return NextResponse.json({ 
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 