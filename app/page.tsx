'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function Home() {
  const [weeklySave, setWeeklySave] = useState(10)
  const [monthlyRate, setMonthlyRate] = useState(2)

  // Calculate 2-year compound projection
  const calcFutureValue = (months: number) => {
    const r = monthlyRate / 100
    const monthlyContrib = weeklySave * 4.33
    let bal = 50 // starting with $50
    for (let m = 0; m < months; m++) {
      bal = bal * (1 + r) + monthlyContrib
    }
    return bal
  }

  return (
    <div className="space-y-20 pb-12">
      {/* Hero Section */}
      <section className="pt-6 pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider">
              <span>🏦 The Modern Bank of Mom &amp; Dad</span>
              <span className="text-blue-300">·</span>
              <span>Now with Sub-Accounts &amp; AI API</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.1]">
              Be Your Kids&apos; First Bank —{' '}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 bg-clip-text text-transparent">
                Teach Real Money Skills.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-600 leading-relaxed max-w-2xl">
              You already act as the bank for your kids&apos; allowance, birthday cash, and store
              purchases. TrackAllowance gives every child their own online bank dashboard with{' '}
              <strong>Sub-Account Savings Jars</strong>, <strong>Parent-Paid Interest</strong>,{' '}
              <strong>Chores &amp; Bounties</strong>, and an <strong>AI Bot API</strong> — with zero
              debit card fees.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/parent"
                className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-4 px-8 rounded-2xl text-base shadow-lg shadow-blue-600/20 transition-all"
              >
                Start Your Family Bank Free →
              </Link>
              <Link
                href="/pricing"
                className="bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 font-bold py-4 px-6 rounded-2xl text-base transition-all"
              >
                View Free vs. Pro Plans
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-gray-500 pt-2">
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600 font-bold">✓</span> Free forever starter plan
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600 font-bold">✓</span> No SSN or plastic card fees
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600 font-bold">✓</span> 30-second Google Sign-In
              </span>
            </div>
          </div>

          {/* Interactive Mockup Preview Card */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                    Live Account Preview
                  </span>
                  <h3 className="text-xl font-extrabold text-gray-900">Judah&apos;s Family Bank</h3>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  📈 +2%/mo Interest
                </span>
              </div>

              {/* Balances */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-slate-900 text-white p-3.5 rounded-2xl">
                  <div className="text-[10px] uppercase text-slate-300 font-semibold">Total</div>
                  <div className="text-xl font-extrabold mt-0.5">$245.50</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl">
                  <div className="text-[10px] uppercase text-emerald-700 font-semibold">
                    Checking
                  </div>
                  <div className="text-xl font-extrabold text-emerald-900 mt-0.5">$65.50</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 p-3.5 rounded-2xl">
                  <div className="text-[10px] uppercase text-purple-700 font-semibold">
                    Sub-Accounts
                  </div>
                  <div className="text-xl font-extrabold text-purple-900 mt-0.5">$180.00</div>
                </div>
              </div>

              {/* Sub-Account Jars Preview */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Active Sub-Accounts &amp; Savings Goals
                </div>

                <div className="p-3.5 rounded-2xl border border-blue-200 bg-blue-50/50">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-bold text-sm text-gray-900">🚲 Mountain Bike Goal</span>
                    <span className="text-xs font-extrabold text-blue-700">$120 / $150 (80%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: '80%' }} />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-sm text-gray-900">🐷 Long-Term Savings Jar</div>
                    <div className="text-xs text-emerald-700">⚡ 20% Auto-Split of Allowance</div>
                  </div>
                  <div className="text-base font-extrabold text-emerald-900">$45.00</div>
                </div>

                <div className="p-3.5 rounded-2xl border border-rose-200 bg-rose-50/50 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-sm text-gray-900">❤️ Giving &amp; Charity</div>
                    <div className="text-xs text-rose-700">⚡ 10% Auto-Split of Allowance</div>
                  </div>
                  <div className="text-base font-extrabold text-rose-900">$15.00</div>
                </div>
              </div>

              {/* AI Bot Toast Preview */}
              <div className="bg-indigo-950 text-white p-3.5 rounded-2xl flex items-center gap-3 text-xs">
                <span className="text-xl">🤖</span>
                <div>
                  <div className="font-bold text-emerald-300">Grokbot / AI Banker Connected</div>
                  <div className="text-indigo-200">
                    &ldquo;Added $10 chore bonus to Judah&apos;s balance!&rdquo;
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="space-y-8">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
            Everything You Need to Run a Family Bank
          </h2>
          <p className="text-gray-600 mt-2">
            Built by a parent of three to solve the real problem of cashless family allowances.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon="🐷"
            badge="NEW"
            title="Sub-Accounts & Savings Jars"
            description="Kids divide their balance between Available Checking, ongoing Sub-Account Buckets (Save, Give, Invest), and specific Target Goals with progress bars and auto-split rules."
          />
          <FeatureCard
            icon="📈"
            badge="NEW"
            title="Parent-Paid Compound Interest"
            description="Set a monthly parent interest rate (like 2%/mo) so your kids see firsthand how saving money pays off exponentially over time."
          />
          <FeatureCard
            icon="⭐"
            badge="NEW"
            title="Chores & Bounties Board"
            description="Post one-time bounties or daily/weekly jobs. Kids tap 'I Did It!' from their dashboard and parents approve & pay in one click."
          />
          <FeatureCard
            icon="🤖"
            badge="PRO"
            title="AI Voice & Grokbot API"
            description="Out at a store? Tell your AI assistant to deduct $8.50 from a child's balance or check their spendable checking via our secure Bearer API."
          />
          <FeatureCard
            icon="🤝"
            title="Co-Parent Contributions Settlement"
            description="Share access with your spouse or grandparents. Automatically track which parent paid cash for kid purchases each month."
          />
          <FeatureCard
            icon="🔒"
            title="Kid-Friendly Dashboards & Privacy"
            description="Every child gets a custom URL (/name) they can bookmark on their tablet or phone, with public or private access controls."
          />
        </div>
      </section>

      {/* Interactive Compound Interest Simulator Section */}
      <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-8 sm:p-10 shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-4">
            <span className="inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
              Try the Interactive Calculator
            </span>
            <h2 className="text-3xl font-extrabold">
              Show Your Kids the Magic of Compound Interest
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Real banks pay 0.01% APY — kids don&apos;t care about 2 cents a year. When the{' '}
              <strong>Bank of Mom &amp; Dad</strong> pays 1% to 3% monthly interest, kids suddenly
              want to save every dollar they get!
            </p>

            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between text-sm font-semibold mb-1">
                  <span>Weekly Allowance Saved:</span>
                  <span className="text-emerald-300 font-extrabold">${weeklySave}/week</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="40"
                  step="1"
                  value={weeklySave}
                  onChange={(e) => setWeeklySave(parseInt(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm font-semibold mb-1">
                  <span>Parent Monthly Interest Rate:</span>
                  <span className="text-emerald-300 font-extrabold">{monthlyRate}% / month</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={monthlyRate}
                  onChange={(e) => setMonthlyRate(parseFloat(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 grid grid-cols-2 gap-4">
            {[
              { label: 'In 6 Months', months: 6 },
              { label: 'In 1 Year', months: 12 },
              { label: 'In 2 Years', months: 24 },
              { label: 'In 3 Years', months: 36 },
            ].map((box) => (
              <div
                key={box.label}
                className="bg-white/10 border border-white/10 rounded-2xl p-5 text-center"
              >
                <div className="text-xs text-indigo-200 font-medium">{box.label}</div>
                <div className="text-3xl font-extrabold text-emerald-300 mt-1">
                  ${calcFutureValue(box.months).toFixed(0)}
                </div>
                <div className="text-[11px] text-slate-300 mt-1">Starting from $50 balance</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free vs Paid Comparison Callout */}
      <section className="bg-white rounded-3xl border border-gray-200 p-8 sm:p-10 shadow-sm">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Start Free Forever. Upgrade When Ready.
          </h2>
          <p className="text-gray-600 text-sm mt-2">
            All classic allowance tracking features are free forever. Upgrade to{' '}
            <strong>Family Bank Pro</strong> ($3.25/mo billed annually) for unlimited sub-accounts,
            auto-split rules, chores, compound interest, and AI bot access.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="p-6 rounded-2xl border border-gray-200 bg-gray-50/50 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-bold text-gray-900">Starter Family Bank</h3>
                <span className="text-lg font-extrabold text-gray-900">$0</span>
              </div>
              <p className="text-xs text-gray-500 mb-4">All current core features, free forever</p>
              <ul className="space-y-2 text-sm text-gray-700 mb-6">
                <li>✓ Unlimited credit &amp; debit transactions</li>
                <li>✓ Up to 3 Sub-Accounts / Savings Goals per child</li>
                <li>✓ Weekly allowance scheduling &amp; family sharing</li>
                <li>✓ Kid dashboards &amp; Parent Contributions tracker</li>
              </ul>
            </div>
            <Link
              href="/parent"
              className="block text-center py-3 px-4 rounded-xl bg-white border border-gray-300 hover:bg-gray-100 font-bold text-sm text-gray-900"
            >
              Get Started Free
            </Link>
          </div>

          <div className="p-6 rounded-2xl border-2 border-blue-600 bg-blue-50/30 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-bold text-gray-900">Family Bank Pro</h3>
                <span className="text-lg font-extrabold text-blue-700">$3.25/mo</span>
              </div>
              <p className="text-xs text-blue-700 font-medium mb-4">
                Billed $39/year (or $4.99/mo) · 14-day free trial
              </p>
              <ul className="space-y-2 text-sm text-gray-800 mb-6">
                <li>★ Unlimited Sub-Accounts &amp; Auto-Split % Rules</li>
                <li>★ Parent-Paid Compound Interest &amp; Wealth Simulator</li>
                <li>★ Interactive Chores &amp; Bounties Board</li>
                <li>★ AI Banker &amp; Grokbot / Siri / ChatGPT API + CSV Export</li>
              </ul>
            </div>
            <Link
              href="/pricing"
              className="block text-center py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-sm text-white shadow-sm"
            >
              Explore Pro &amp; Start Free Trial →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer Attribution */}
      <footer className="text-center border-t border-gray-200 pt-8 text-sm text-gray-500 space-y-2">
        <p>
          Created by{' '}
          <a
            href="https://github.com/beaucarnes"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-medium"
          >
            Beau Carnes
          </a>{' '}
          · Built for families who want simple, smart financial education.
        </p>
        <div className="flex justify-center gap-4 text-xs">
          <Link href="/parent" className="hover:text-gray-800">
            Parent Dashboard
          </Link>
          <Link href="/pricing" className="hover:text-gray-800">
            Pricing
          </Link>
          <Link href="/help" className="hover:text-gray-800">
            How to Use
          </Link>
          <Link href="/parent/ai-bot" className="hover:text-gray-800">
            AI Bot API
          </Link>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  badge,
  title,
  description,
}: {
  icon: string
  badge?: string
  title: string
  description: string
}) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl">
          {icon}
        </span>
        {badge && (
          <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
            {badge}
          </span>
        )}
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  )
}
