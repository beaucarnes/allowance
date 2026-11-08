import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminFirestore } from '@/app/lib/firebase-admin-app'
import { generateParentBotToken } from '@/app/lib/allowance-api/parent-token'
import { FieldValue } from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function verifyParent(request: Request): Promise<{ uid: string; email: string } | null> {
  // Check Bearer Firebase ID token first (if passed from client)
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.slice(7).trim()
    if (idToken) {
      try {
        const decoded = await getAdminAuth().verifyIdToken(idToken)
        return { uid: decoded.uid, email: decoded.email || '' }
      } catch {
        // Fall through to session cookie
      }
    }
  }

  const cookieStore = cookies()
  const session = cookieStore.get('session')?.value
  if (!session) return null

  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true)
    return {
      uid: decoded.uid,
      email: decoded.email || decoded.firebase?.identities?.['google.com']?.[0] || '',
    }
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const user = await verifyParent(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = getAdminFirestore()
    const [tokenDoc, kidsSnap] = await Promise.all([
      db.collection('botTokens').doc(user.uid).get(),
      db.collection('kids').where('parentId', '==', user.uid).get(),
    ])

    const children = kidsSnap.docs.map((d) => ({
      name: String(d.get('name') || ''),
      slug: String(d.get('slug') || ''),
    }))

    if (!tokenDoc.exists) {
      return NextResponse.json({
        hasToken: false,
        tokenPrefix: null,
        createdAt: null,
        children,
      })
    }

    const data = tokenDoc.data()
    const createdAt = data?.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null

    return NextResponse.json({
      hasToken: true,
      tokenPrefix: data?.tokenPrefix || 'ta_live_••••••••',
      createdAt,
      children,
    })
  } catch (error) {
    console.error('Error reading bot token status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const user = await verifyParent(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { plaintext, tokenHash, tokenPrefix } = generateParentBotToken()
    const db = getAdminFirestore()

    await db.collection('botTokens').doc(user.uid).set({
      uid: user.uid,
      email: user.email,
      tokenHash,
      tokenPrefix,
      createdAt: FieldValue.serverTimestamp(),
    })

    const kidsSnap = await db.collection('kids').where('parentId', '==', user.uid).get()
    const children = kidsSnap.docs.map((d) => ({
      name: String(d.get('name') || ''),
      slug: String(d.get('slug') || ''),
    }))

    return NextResponse.json({
      token: plaintext,
      tokenPrefix,
      createdAt: new Date().toISOString(),
      children,
    })
  } catch (error) {
    console.error('Error generating bot token:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const user = await verifyParent(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = getAdminFirestore()
    await db.collection('botTokens').doc(user.uid).delete()
    return NextResponse.json({ revoked: true })
  } catch (error) {
    console.error('Error revoking bot token:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
