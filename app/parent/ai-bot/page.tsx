'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function AiBotApiPage() {
  const [copied, setCopied] = useState<string | null>(null)

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const grokPrompt = `You are connected to the TrackAllowance Family Bank API at https://www.trackallowance.com.
Always authenticate with header: Authorization: Bearer <ALLOWANCE_BOT_TOKEN>

Available Endpoints:
1. GET /api/allowance/summary
   Optional query: ?child=elon|corwin|judah
   Returns each child's total balance, spendableBalance (Checking), savedInSubAccounts, weeklyAllowance, interestRateMonthly, and active subAccounts (savings jars & goals).

2. POST /api/allowance/entries
   Headers:
     Content-Type: application/json
     Idempotency-Key: <unique 16-128 char key>
   Body:
     {
       "child": "elon" | "corwin" | "judah",
       "type": "debit" | "credit",
       "amount": "12.50",
       "description": "Bought LEGO set",
       "date": "YYYY-MM-DD"
     }

3. GET /api/allowance/history?child=judah&start=YYYY-MM-DD&end=YYYY-MM-DD&type=all|debit|credit&limit=25
   Returns paginated ledger entries for the date window.

4. GET /api/allowance/health
   Verifies token authentication and write readiness.`

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full mb-1">
            🤖 Family Bank Pro Feature
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900">
            AI Banker &amp; Grokbot API Integration
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Connect Grokbot, ChatGPT Actions, Claude MCP, or Apple Siri Shortcuts to manage your
            kids&apos; allowance by voice or chat.
          </p>
        </div>
        <Link
          href="/parent"
          className="bg-gray-800 hover:bg-gray-900 text-white font-semibold px-4 py-2 rounded-xl text-sm self-start sm:self-auto"
        >
          ← Back to Parent Dashboard
        </Link>
      </div>

      {/* System Prompt Copy Card */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Ready-to-Use Grokbot / AI Agent Prompt</h2>
            <p className="text-xs text-slate-300">
              Includes the new <code className="text-emerald-300">/api/allowance/summary</code>{' '}
              endpoint for checking sub-accounts &amp; spendable balances!
            </p>
          </div>
          <button
            onClick={() => copyText('prompt', grokPrompt)}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-colors"
          >
            {copied === 'prompt' ? '✓ Copied!' : 'Copy Bot Instructions'}
          </button>
        </div>
        <pre className="bg-slate-950/90 border border-white/10 rounded-xl p-4 text-xs text-slate-200 overflow-x-auto whitespace-pre-wrap">
          {grokPrompt}
        </pre>
      </div>

      {/* Endpoint Reference Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-xs">
              POST
            </span>
            <code className="font-bold text-sm text-gray-900">/api/allowance/entries</code>
          </div>
          <p className="text-sm text-gray-600">
            Idempotently record a credit or debit transaction for a child and update their total
            balance in a single atomic Firestore transaction.
          </p>
          <pre className="bg-gray-900 text-gray-100 rounded-xl p-3 text-xs overflow-x-auto">
{`curl -X POST https://www.trackallowance.com/api/allowance/entries \\
  -H "Authorization: Bearer $ALLOWANCE_BOT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: grok-2026-11-08-0001" \\
  -d '{
    "child": "judah",
    "type": "debit",
    "amount": "8.50",
    "description": "Ice cream shop",
    "date": "2026-11-08"
  }'`}
          </pre>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-xs">
              GET
            </span>
            <code className="font-bold text-sm text-gray-900">/api/allowance/summary</code>
            <span className="text-[11px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">
              NEW
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Fetch each child&apos;s Total Balance, Available Checking (Spendable Balance), Saved in
            Sub-Accounts, Weekly Allowance, and active Sub-Account Jars/Goals.
          </p>
          <pre className="bg-gray-900 text-gray-100 rounded-xl p-3 text-xs overflow-x-auto">
{`curl "https://www.trackallowance.com/api/allowance/summary?child=elon" \\
  -H "Authorization: Bearer $ALLOWANCE_BOT_TOKEN"`}
          </pre>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-xs">
              GET
            </span>
            <code className="font-bold text-sm text-gray-900">/api/allowance/history</code>
          </div>
          <p className="text-sm text-gray-600">
            Read-only date-range ledger history with cursor pagination and optional{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">type=debit|credit|all</code> filter.
          </p>
          <pre className="bg-gray-900 text-gray-100 rounded-xl p-3 text-xs overflow-x-auto">
{`curl "https://www.trackallowance.com/api/allowance/history?child=corwin&start=2026-10-01&end=2026-11-08" \\
  -H "Authorization: Bearer $ALLOWANCE_BOT_TOKEN"`}
          </pre>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-xs">
              GET
            </span>
            <code className="font-bold text-sm text-gray-900">/api/allowance/health</code>
          </div>
          <p className="text-sm text-gray-600">
            Verify Bearer token authentication, Firebase project binding, and allowed children
            scope without reading ledger rows.
          </p>
          <pre className="bg-gray-900 text-gray-100 rounded-xl p-3 text-xs overflow-x-auto">
{`curl https://www.trackallowance.com/api/allowance/health \\
  -H "Authorization: Bearer $ALLOWANCE_BOT_TOKEN"`}
          </pre>
        </div>
      </div>
    </div>
  )
}
