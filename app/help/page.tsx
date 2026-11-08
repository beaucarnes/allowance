import Link from 'next/link'

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
      <div>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full mb-2">
          📖 Family Banker Guide
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
          How to Use TrackAllowance
        </h1>
        <p className="text-gray-600 mt-1">
          Everything you need to run the Bank of Mom &amp; Dad for your children.
        </p>
      </div>

      <div className="space-y-8">
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-3">
          <h2 className="text-xl font-bold text-gray-900">1. Getting Started</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>Sign in with your Google account from the Parent Dashboard.</li>
            <li>Click &ldquo;Add New Kid&rdquo; to create each child&apos;s bank account.</li>
            <li>
              Choose a unique URL slug (like <code className="bg-gray-100 px-1.5 py-0.5 rounded">/judah</code>) that you can bookmark on their device.
            </li>
          </ol>
        </section>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">
            2. Sub-Accounts, Savings Jars &amp; Goals
          </h2>
          <p className="text-sm text-gray-700">
            Each child&apos;s <strong>Total Bank Balance</strong> is divided into{' '}
            <strong>Available to Spend (Checking)</strong> and{' '}
            <strong>Saved in Sub-Accounts</strong>:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
            <li>
              <strong>Target Savings Goals:</strong> Set a target dollar amount (e.g., $150 for a
              bike) and optional deadline. Track progress at 25%, 50%, 75%, and 100%!
            </li>
            <li>
              <strong>Ongoing Sub-Account Buckets:</strong> Create permanent envelopes like{' '}
              <em>Long-Term Savings</em>, <em>Giving / Charity</em>, or <em>Invest</em>.
            </li>
            <li>
              <strong>Auto-Split Allowance Rules:</strong> Assign an optional percentage (e.g., 20%
              to Savings, 10% to Giving) so weekly allowances automatically split across sub-accounts.
            </li>
            <li>
              <strong>Spend Directly from a Sub-Account:</strong> Click <strong>🛍️ Spend</strong> on
              any sub-account to deduct from that jar AND automatically record the purchase on the
              main transaction ledger!
            </li>
          </ul>
        </section>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-3">
          <h2 className="text-xl font-bold text-gray-900">
            3. Parent-Paid Compound Interest &amp; Chores
          </h2>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
            <li>
              <strong>Monthly Parent Interest:</strong> Set a monthly interest rate (e.g., 2%/month)
              to reward saving. Click <strong>Pay Monthly Interest</strong> once a month to credit
              their accrued interest.
            </li>
            <li>
              <strong>Chores &amp; Bounties Board:</strong> Post jobs with dollar rewards. Kids can
              tap <strong>I Did It!</strong> on their dashboard, and you can approve &amp; pay in one
              click.
            </li>
          </ul>
        </section>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-3">
          <h2 className="text-xl font-bold text-gray-900">
            4. Parent Contributions &amp; AI Bot API
          </h2>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
            <li>
              <strong>Parent Contributions (/parent/contributions):</strong> Shows all debit
              purchases advanced by each parent during the month, minus cash deposits handed to that
              parent (excluding weekly allowances, chores, and interest payouts).
            </li>
            <li>
              <strong>Grokbot &amp; AI Banker API (/parent/ai-bot):</strong> Connect your AI bot to{' '}
              <code className="bg-gray-100 px-1.5 py-0.5 rounded">/api/allowance/entries</code>,{' '}
              <code className="bg-gray-100 px-1.5 py-0.5 rounded">/api/allowance/history</code>, and{' '}
              <code className="bg-gray-100 px-1.5 py-0.5 rounded">/api/allowance/summary</code>.
            </li>
          </ul>
        </section>

        <div className="flex justify-center gap-4 pt-4">
          <Link
            href="/parent"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl text-sm shadow-sm transition-colors"
          >
            Go to Parent Dashboard
          </Link>
          <Link
            href="/pricing"
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 px-6 rounded-xl text-sm transition-colors"
          >
            View Plans &amp; Pricing
          </Link>
        </div>
      </div>
    </div>
  )
}
