import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminFirestore } from '@/app/lib/firebase-admin-app'

export const dynamic = 'force-dynamic'

function verifyStripeSignature(payload: string, sigHeader: string, secret: string): boolean {
  const parts = sigHeader.split(',')
  let timestamp = ''
  const signatures: string[] = []

  for (const part of parts) {
    const [k, v] = part.split('=')
    if (k === 't') timestamp = v
    if (k === 'v1') signatures.push(v)
  }

  if (!timestamp || signatures.length === 0) return false

  const signedPayload = `${timestamp}.${payload}`
  const expected = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex')
  const expectedBuf = Buffer.from(expected, 'utf8')

  return signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, 'utf8')
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)
  })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature') || ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (webhookSecret && !verifyStripeSignature(rawBody, sig, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid Stripe webhook signature' }, { status: 400 })
  }

  try {
    const event = JSON.parse(rawBody)
    const db = getAdminFirestore()

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const uid = session.client_reference_id || session.metadata?.uid
      if (uid) {
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
      }
    } else if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const sub = event.data.object
      let uid = sub.metadata?.uid

      if (!uid && sub.customer) {
        const snap = await db
          .collection('subscriptions')
          .where('stripeCustomerId', '==', sub.customer)
          .limit(1)
          .get()
        if (!snap.empty) {
          uid = snap.docs[0].id
        }
      }

      if (uid) {
        const isActive =
          event.type !== 'customer.subscription.deleted' &&
          (sub.status === 'active' || sub.status === 'trialing')
        await db
          .collection('subscriptions')
          .doc(uid)
          .set(
            {
              tier: isActive ? 'pro' : 'free',
              status: sub.status || 'canceled',
              stripeSubscriptionId: sub.id,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Error handling Stripe webhook:', err)
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 })
  }
}
