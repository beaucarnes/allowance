'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { auth } from '@/app/lib/firebase'

interface ChildInfo {
  name: string
  slug: string
}

export default function AiBotApiPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [hasToken, setHasToken] = useState(false)
  const [tokenPrefix, setTokenPrefix] = useState<string | null>(null)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [newlyGeneratedToken, setNewlyGeneratedToken] = useState<string | null>(null)
  const [children, setChildren] = useState<ChildInfo[]>([])
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      setUser(u)
      if (u) {
        await fetchTokenStatus(u)
      } else {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [])

  const fetchTokenStatus = async (u: any) => {
    setLoading(true)
    try {
      const idToken = await u.getIdToken()
      const res = await fetch('/api/parent/bot-token', {
        headers: { Authorization: `Bearer ${idToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setHasToken(Boolean(data.hasToken))
        setTokenPrefix(data.tokenPrefix || null)
        setCreatedAt(data.createdAt || null)
        setChildren(Array.isArray(data.children) ? data.children : [])
      }
    } catch (err) {
      console.error('Error fetching token status:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateToken = async () => {
    if (!user) return
    if (
      hasToken &&
      !confirm(
        'Generating a new token will immediately replace and invalidate your previous token. Continue?'
      )
    ) {
      return
    }

    setBusy(true)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/parent/bot-token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setNewlyGeneratedToken(data.token)
        setHasToken(true)
        setTokenPrefix(data.tokenPrefix)
        setCreatedAt(data.createdAt)
        if (Array.isArray(data.children)) {
          setChildren(data.children)
        }
      } else {
        alert('Failed to generate token. Please try signing in again.')
      }
    } catch (err) {
      console.error('Error generating token:', err)
      alert('Failed to generate token.')
    } finally {
      setBusy(false)
    }
  }

  const handleRevokeToken = async () => {
    if (!user) return
    if (!confirm('Revoke your AI Bot API token? Connected bots will stop working immediately.')) {
      return
    }

    setBusy(true)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/parent/bot-token', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      })
      if (res.ok) {
        setHasToken(false)
        setTokenPrefix(null)
        setCreatedAt(null)
        setNewlyGeneratedToken(null)
      }
    } catch (err) {
      console.error('Error revoking token:', err)
    } finally {
      setBusy(false)
    }
  }

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const childSlugsList =
    children.length > 0 ? children.map((c) => c.slug).join(' | ') : 'elon | corwin | judah'
  const exampleSlug = children[0]?.slug || 'judah'
  const displayToken = newlyGeneratedToken || '<YOUR_ALLOWANCE_BOT_TOKEN>'

  const grokPrompt = `You are connected to the TrackAllowance Family Bank API at https://www.trackallowance.com.
Always authenticate with header: Authorization: Bearer ${displayToken}

Allowed child slugs for this family: ${childSlugsList}

Available Endpoints:
1. GET /api/allowance/summary
   Optional query: ?child=${exampleSlug}
   Returns each child's total balance, spendableBalance (Checking), savedInSubAccounts, weeklyAllowance, interestRateMonthly, and active subAccounts (savings jars & goals).

2. POST /api/allowance/entries
   Headers:
     Content-Type: application/json
     Idempotency-Key: <unique 16-128 char key>
   Body:
     {
       "child": "${exampleSlug}",
       "type": "debit" | "credit",
       "amount": "12.50",
       "description": "Bought LEGO set",
       "date": "YYYY-MM-DD"
     }

3. GET /api/allowance/history?child=${exampleSlug}&start=YYYY-MM-DD&end=YYYY-MM-DD&type=all|debit|credit&limit=25
   Returns paginated ledger entries for the date window.

4. GET /api/allowance/health
   Verifies token authentication and returns your allowed child slugs.`

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full mb-1">
            🤖 Family Bank Pro Feature
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900">
            AI Banker &amp; Grokbot API Integration
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Generate your personal Bearer API Token below to connect Grokbot, ChatGPT, Claude, or
            Apple Siri Shortcuts to your family bank.
          </p>
        </div>
        <Link
          href="/parent"
          className="bg-gray-800 hover:bg-gray-900 text-white font-semibold px-4 py-2 rounded-xl text-sm self-start sm:self-auto"
        >
          ← Back to Parent Dashboard
        </Link>
      </div>

      {/* Self-Serve API Token Generator Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-indigo-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
              <span>🔑</span>
              <span>Your Personal Allowance Bot Token</span>
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Each token is scoped strictly to the children you own (
              {children.length > 0 ? (
                children.map((c) => (
                  <code
                    key={c.slug}
                    className="mx-0.5 px-1.5 py-0.5 bg-indigo-50 text-indigo-800 rounded text-xs font-bold"
                  >
                    {c.slug}
                  </code>
                ))
              ) : (
                <span>your kids</span>
              )}
              ) and stored as a one-way SHA-256 hash.
            </p>
          </div>

          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateToken}
                disabled={busy || loading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-xl text-sm shadow-sm transition-colors"
              >
                {busy
                  ? 'Working...'
                  : hasToken
                  ? '↻ Rotate / Generate New Token'
                  : '🔑 Generate API Token'}
              </button>
              {hasToken && (
                <button
                  onClick={handleRevokeToken}
                  disabled={busy}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors"
                >
                  Revoke
                </button>
              )}
            </div>
          ) : (
            <Link
              href="/parent"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl text-sm"
            >
              Sign In to Generate Token →
            </Link>
          )}
        </div>

        {/* Newly Generated Token Reveal Banner */}
        {newlyGeneratedToken && (
          <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-400 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                🎉 Copy Your New Token Now (Shown Only Once!)
              </span>
              <button
                onClick={() => copyText('token', newlyGeneratedToken)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs"
              >
                {copied === 'token' ? '✓ Copied Token!' : 'Copy Token'}
              </button>
            </div>
            <code className="block w-full p-3 rounded-lg bg-white border border-emerald-300 font-mono text-sm text-gray-900 break-all select-all">
              {newlyGeneratedToken}
            </code>
            <p className="text-xs text-emerald-800">
              Notice: We also pre-filled this token into the Grokbot System Prompt below so you can
              copy the whole prompt in one click!
            </p>
          </div>
        )}

        {/* Existing Token Status */}
        {user && !loading && hasToken && !newlyGeneratedToken && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-gray-700">Active Token:</span>
              <code className="font-mono font-bold text-gray-900 bg-white px-2 py-0.5 rounded border">
                {tokenPrefix}
              </code>
            </div>
            {createdAt && (
              <span className="text-xs text-gray-500">
                Created {new Date(createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* System Prompt Copy Card */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Ready-to-Use Grokbot / AI Agent Prompt</h2>
            <p className="text-xs text-slate-300">
              Automatically customized with your children&apos;s slugs (
              <code className="text-emerald-300">{childSlugsList}</code>) and the{' '}
              <code className="text-emerald-300">/api/allowance/summary</code> endpoint!
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
  -H "Authorization: Bearer ${displayToken}" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: bot-2026-11-08-0001" \\
  -d '{
    "child": "${exampleSlug}",
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
{`curl "https://www.trackallowance.com/api/allowance/summary?child=${exampleSlug}" \\
  -H "Authorization: Bearer ${displayToken}"`}
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
{`curl "https://www.trackallowance.com/api/allowance/history?child=${exampleSlug}&start=2026-10-01&end=2026-11-08" \\
  -H "Authorization: Bearer ${displayToken}"`}
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
  -H "Authorization: Bearer ${displayToken}"`}
          </pre>
        </div>
      </div>
    </div>
  )
}
