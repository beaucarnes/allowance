import { getAdminAuth } from '@/app/lib/firebase-admin-app';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Session request body:', { 
      hasIdToken: !!body.idToken,
      idTokenLength: body.idToken?.length 
    });

    if (!body.idToken) {
      return NextResponse.json({ error: 'No ID token provided' }, { status: 400 });
    }

    const auth = getAdminAuth();
    console.log('Got admin auth, creating session cookie...');

    const sessionCookie = await auth.createSessionCookie(body.idToken, {
      expiresIn: 60 * 60 * 24 * 5 * 1000 // 5 days
    });

    console.log('Session cookie created, length:', sessionCookie.length);

    const response = new NextResponse(JSON.stringify({ status: 'success' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Set the cookie
    response.cookies.set({
      name: 'session',
      value: sessionCookie,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 5, // 5 days
    });

    return response;
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 