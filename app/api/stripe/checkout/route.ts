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
    return {
      uid: decoded.uid,
      email: decoded.email || decoded.firebase?.identities?.['google.com']?.[0] || '',
    }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const user = await resolveUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Please sign in as a parent first.' }, { status: 401 })
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY
  if (!stripeSecret) {
    return NextResponse.json({ error: 'Stripe is not configured on this server.' }, { status: 500 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const billing = body.billing === 'monthly' ? 'monthly' : 'annual'

    const priceId =
      billing === 'monthly'
        ? process.env.STRIPE_PRICE_MONTHLY || 'price_1UZbNBBRTVk7hxRFIvuPqh7D'
        : process.env.STRIPE_PRICE_YEARLY || 'price_1UZbNBBRTVk7hxRFo3nji6tJ'

    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://www.trackallowance.com'

    // Check if user already has a Stripe customer ID in Firestore
    const db = getAdminFirestore()
    const subDoc = await db.collection('subscriptions').doc(user.uid).get()
    const existingCustomerId = subDoc.exists ? subDoc.data()?.stripeCustomerId : null

    const params: Record<string, string> = {
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      client_reference_id: user.uid,
      'metadata[uid]': user.uid,
      'metadata[billingCycle]': billing,
      'subscription_data[trial_period_days]': '14',
      'subscription_data[metadata][uid]': user.uid,
      'subscription_data[metadata][billingCycle]': billing,
      allow_promotion_codes: 'true',
      success_url: `${origin}/pricing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?canceled=1`,
    }

    if (existingCustomerId) {
      params.customer = existingCustomerId
    } else if (user.email) {
      params.customer_email = user.email
    }

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    })

    const sessionData = await res.json()
    if (!res.ok || !sessionData.url) {
      console.error('Stripe checkout creation failed:', sessionData)
      return NextResponse.json(
        { error: sessionData?.error?.message || 'Failed to create Stripe checkout session.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: sessionData.url, sessionId: sessionData.id })
  } catch (err) {
    console.error('Error creating Stripe checkout:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
