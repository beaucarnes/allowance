import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  const cookieStore = cookies()
  
  // Clear the session cookie
  cookieStore.delete('session')
  
  return new NextResponse(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Set-Cookie': 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }
  })
} 