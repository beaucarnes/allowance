'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { auth, db } from '../lib/firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

export default function PricingPage() {
  const [billing, setBilling] = useState<'annual' | 'monthly'>('annual')
  const [user, setUser] = useState<any>(null)
  const [currentTier, setCurrentTier] = useState<'free' | 'pro'>('free')
  const [activating, setActivating] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      setUser(u)
      if (u) {
        try {
          const snap = await getDoc(doc(db, 'subscriptions', u.uid))
          if (snap.exists() && snap.data()?.tier === 'pro') {
            setCurrentTier('pro')
          }
        } catch (err) {
          console.error('Error checking subscription:', err)
        }
      }
    })
    return () => unsub()
  }, [])

  const handleUpgrade = async () => {
    const stripeLink = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK
    if (stripeLink) {
      window.location.href = stripeLink
      return
    }

    if (!user) {
      window.location.href = '/parent?upgrade=pro'
      return
    }

    setActivating(true)
    try {
      const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      await setDoc(
        doc(db, 'subscriptions', user.uid),
        {
          uid: user.uid,
          email: user.email || '',
          tier: 'pro',
          billingCycle: billing,
          trialEndsAt: trialEnd,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
      setCurrentTier('pro')
      setBanner(
        '🎉 Family Bank Pro is now active on your account! All Pro features (Unlimited Sub-Accounts, Parent Interest, Chores & AI Bot API) are unlocked.'
      )
    } catch (err) {
      console.error('Error activating Pro plan:', err)
      alert('Could not activate right now. Please make sure you are signed in.')
    } finally {
      setActivating(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3 border border-blue-200">
          🏦 Simple, Family-Friendly Pricing
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
          Run the Bank of Mom &amp; Dad Like a Pro
        </h1>
        <p className="text-lg text-gray-600">
          Every core allowance tracking feature is <strong>100% free forever</strong>. Upgrade to{' '}
          <strong>Family Bank Pro</strong> to unlock unlimited sub-account jars, auto-split rules,
          parent-paid compound interest, chores &amp; bounties, and AI voice/bot banking.
        </p>

        {/* Billing Toggle */}
        <div className="mt-8 inline-flex items-center p-1.5 bg-gray-100 rounded-2xl border border-gray-200">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              billing === 'monthly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly ($4.99/mo)
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              billing === 'annual'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>Annual ($39/yr)</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold ${
                billing === 'annual'
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              Save 35%
            </span>
          </button>
        </div>
      </div>

      {banner && (
        <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-md text-center font-medium">
          {banner}
        </div>
      )}

      {/* 2-Card Plan Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        {/* Free Plan */}
        <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-bold text-gray-900">Starter Family Bank</h2>
              <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-gray-100 text-gray-700">
                Free Forever
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Everything you need to replace paper allowance charts and track balances online.
            </p>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-5xl font-extrabold text-gray-900">$0</span>
              <span className="text-gray-500 font-medium">/ forever</span>
            </div>

            <div className="border-t border-gray-100 pt-6 space-y-3.5 text-sm text-gray-700">
              <p className="font-bold text-xs uppercase tracking-wider text-gray-400">
                Included in Free:
              </p>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>
                  <strong>Full Allowance &amp; Spending Ledger</strong> (unlimited credits &amp;
                  debits)
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>
                  <strong>Starter Sub-Accounts &amp; Savings Goals</strong> (up to 3 jars per child)
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>
                  <strong>Weekly Allowance Scheduling</strong> &amp; 1-click payouts
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>
                  <strong>Kid-Friendly Dashboards</strong> (custom <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">/[slug]</code> URLs with public/private privacy controls)
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>
                  <strong>Co-Parent &amp; Grandparent Sharing</strong> (<code className="text-xs bg-gray-100 px-1 py-0.5 rounded">sharedWith</code> access)
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>
                  <strong>Parent Contributions Tracker</strong> (reconcile who paid cash for what)
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <Link
              href="/parent"
              className="block w-full text-center py-3.5 px-6 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold transition-colors"
            >
              {user ? 'Go to Parent Dashboard' : 'Get Started Free'}
            </Link>
          </div>
        </div>

        {/* Paid Plan: Family Bank Pro */}
        <div className="relative bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 text-white rounded-3xl border-2 border-blue-500 p-8 shadow-xl flex flex-col justify-between">
          <div className="absolute -top-3.5 right-6 bg-gradient-to-r from-blue-500 to-emerald-400 text-slate-950 text-xs font-extrabold uppercase tracking-wider px-3.5 py-1 rounded-full shadow">
            Most Popular for Families
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-bold">Family Bank Pro</h2>
              <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Full Financial Toolkit
              </span>
            </div>
            <p className="text-sm text-slate-300 mb-6">
              Turn allowance into a complete financial education with automated sub-account splits,
              compound interest, chores, and AI voice banking.
            </p>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-extrabold">
                {billing === 'annual' ? '$3.25' : '$4.99'}
              </span>
              <span className="text-slate-300 font-medium">/ month</span>
            </div>
            <p className="text-xs text-emerald-300 mb-6 font-medium">
              {billing === 'annual'
                ? 'Billed as $39/year (saves 35% vs monthly) · 14-day free trial'
                : 'Billed monthly at $4.99/mo · Cancel anytime'}
            </p>

            <div className="border-t border-white/10 pt-6 space-y-3.5 text-sm text-slate-100">
              <p className="font-bold text-xs uppercase tracking-wider text-blue-300">
                Everything in Free, plus:
              </p>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold">★</span>
                <span>
                  <strong>Unlimited Sub-Accounts &amp; Savings Jars</strong> (Save, Spend, Give,
                  Invest + unlimited target goals)
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold">★</span>
                <span>
                  <strong>Auto-Split Allowance Rules</strong> (e.g., automatically route 20% to
                  Savings &amp; 10% to Giving)
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold">★</span>
                <span>
                  <strong>Parent-Paid Compound Interest Engine</strong> &amp; Kid Future Wealth
                  Simulator
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold">★</span>
                <span>
                  <strong>Interactive Chores &amp; Bounties Board</strong> (kids mark jobs done,
                  parents approve &amp; pay in 1 click)
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold">★</span>
                <span>
                  <strong>AI Banker &amp; Grokbot / Siri / ChatGPT API</strong> (add transactions &amp;
                  query balances by voice or AI chat)
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-400 font-bold">★</span>
                <span>
                  <strong>30-Day Analytics &amp; 1-Click CSV Ledger Export</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            {currentTier === 'pro' ? (
              <div className="w-full text-center py-3.5 px-6 rounded-xl bg-emerald-500 text-slate-950 font-extrabold">
                ✓ Family Bank Pro Active
              </div>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={activating}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-emerald-400 hover:from-blue-600 hover:to-emerald-500 text-slate-950 font-extrabold transition-all shadow-lg"
              >
                {activating ? 'Activating...' : 'Start 14-Day Free Pro Trial →'}
              </button>
            )}
            <p className="text-center text-xs text-slate-400 mt-2">
              No debit card fees · No per-child fees · One plan covers your whole family
            </p>
          </div>
        </div>
      </div>

      {/* Why Parents Pay for TrackAllowance vs Debit Card Apps */}
      <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
        <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Why Families Choose TrackAllowance Over $10/mo Kid Debit Card Apps
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100">
            <div className="text-2xl mb-2">🏦</div>
            <h4 className="font-bold text-gray-900 text-base mb-1">
              You Are the Bank — Zero Bank Fees or KYC
            </h4>
            <p className="text-gray-600">
              No SSNs, no waiting for plastic cards in the mail, and no $6–$15/mo card replacement
              fees. Track virtual balances while you hold the real money.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-purple-50/50 border border-purple-100">
            <div className="text-2xl mb-2">🐷</div>
            <h4 className="font-bold text-gray-900 text-base mb-1">
              Sub-Accounts &amp; Compound Interest That Actually Teach
            </h4>
            <p className="text-gray-600">
              Kids learn envelope budgeting (Checking vs. Savings Jars vs. Giving) and see how
              parent-paid monthly interest compounds their savings.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-100">
            <div className="text-2xl mb-2">🤖</div>
            <h4 className="font-bold text-gray-900 text-base mb-1">
              First Allowance Tracker with an AI Bot API
            </h4>
            <p className="text-gray-600">
              At the store with your kids? Just tell your AI bot &ldquo;Deduct $12 from Judah for a
              LEGO set&rdquo; and the ledger updates automatically with idempotent safety.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
