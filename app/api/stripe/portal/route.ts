import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAdminAuth, getAdminFirestore } from '@/app/lib/firebase-admin-app'

export const dynamic = 'force-dynamic'

async function resolveUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const idToken = authHeader.slice(7).trim()
    if (idToken) {
      try {
        const decoded = await getAdminAuth().verifyIdToken(idToken)
        return { uid: decoded.uid, email: decoded.email || '' }
      } catch {
        // fallback to cookie
      }
    }
  }

  const session = cookies().get('session')
  if (!session?.value) return null

  try {
    const decoded = await getAdminAuth().verifySessionCookie(session.value, true)
    return { uid: decoded.uid, email: decoded.email || '' }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const user = await resolveUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY
  if (!stripeSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  try {
    const db = getAdminFirestore()
    const subDoc = await db.collection('subscriptions').doc(user.uid).get()
    const customerId = subDoc.exists ? subDoc.data()?.stripeCustomerId : null

    if (!customerId) {
      return NextResponse.json(
        { error: 'No Stripe customer record found for this account.' },
        { status: 400 }
      )
    }

    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://www.trackallowance.com'

    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: customerId,
        return_url: `${origin}/pricing`,
      }).toString(),
    })

    const data = await res.json()
    if (!res.ok || !data.url) {
      return NextResponse.json(
        { error: data?.error?.message || 'Could not open billing portal' },
        { status: 400 }
      )
    }

    return NextResponse.json({ url: data.url })
  } catch (err) {
    console.error('Error creating billing portal session:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
