import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminFirestore } from '@/app/lib/firebase-admin-app'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  if (!stripeSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  try {
    const { sessionId } = await request.json()
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      {
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
        },
      }
    )

    const session = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to retrieve Stripe session' }, { status: 400 })
    }

    const uid = session.client_reference_id || session.metadata?.uid
    if (!uid) {
      return NextResponse.json({ error: 'No user associated with session' }, { status: 400 })
    }

    const isComplete =
      session.status === 'complete' ||
      session.payment_status === 'paid' ||
      session.payment_status === 'no_payment_required'

    if (!isComplete) {
      return NextResponse.json({ error: 'Checkout session not yet complete' }, { status: 400 })
    }

    const db = getAdminFirestore()
    await db
      .collection('subscriptions')
      .doc(uid)
      .set(
        {
          uid,
          email: session.customer_details?.email || session.customer_email || '',
          tier: 'pro',
          status: 'active',
          billingCycle: session.metadata?.billingCycle || 'annual',
          stripeCustomerId: session.customer || null,
          stripeSubscriptionId: session.subscription || null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )

    return NextResponse.json({ ok: true, tier: 'pro' })
  } catch (err) {
    console.error('Error verifying checkout session:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
