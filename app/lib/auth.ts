import { cookies } from 'next/headers';
import { getAdminAuth } from './firebase-admin-app';

export async function verifySession(sessionCookie: string) {
  try {
    const auth = getAdminAuth();
    const decodedClaims = await auth.verifySessionCookie(sessionCookie);
    return decodedClaims;
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}

export function setSession(token: string) {
  cookies().set('session', token, {
    maxAge: 60 * 60 * 24 * 5, // 5 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
} 