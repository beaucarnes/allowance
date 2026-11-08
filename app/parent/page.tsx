'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '../lib/firebase'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import {
  collection,
  query,
  where,
  getDocs,
  or,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import Link from 'next/link'
import AddKidForm from '../components/AddKidForm'

export default function ParentDashboard() {
  const [user, setUser] = useState<any>(null)
  const [kids, setKids] = useState<any[]>([])
  const [subAccountStats, setSubAccountStats] = useState<
    Record<string, { count: number; allocated: number }>
  >({})
  const [pendingChoreCount, setPendingChoreCount] = useState<Record<string, number>>({})
  const router = useRouter()
  const [showAddKidForm, setShowAddKidForm] = useState(false)

  // Inline quick transaction state per kid card
  const [quickTxKidId, setQuickTxKidId] = useState<string | null>(null)
  const [quickType, setQuickType] = useState<'debit' | 'credit'>('debit')
  const [quickAmount, setQuickAmount] = useState('')
  const [quickDesc, setQuickDesc] = useState('')
  const [quickSaving, setQuickSaving] = useState(false)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user)
      if (user) {
        const idToken = await user.getIdToken(true)
        try {
          const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken }),
            credentials: 'include',
          })

          if (response.ok) {
            fetchKids(user.uid, user.email || '')
          } else {
            console.error('Failed to refresh session')
          }
        } catch (error) {
          console.error('Error refreshing session:', error)
        }
      }
    })

    return () => unsubscribe()
  }, [])

  const fetchKids = async (parentId: string, email: string) => {
    try {
      const kidsQuery = query(
        collection(db, 'kids'),
        or(where('parentId', '==', parentId), where('sharedWith', 'array-contains', email))
      )

      const kidsSnapshot = await getDocs(kidsQuery)
      const allKids = kidsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      const uniqueKids = Array.from(new Map(allKids.map((kid) => [kid.id, kid])).values())

      setKids(uniqueKids)

      const statsMap: Record<string, { count: number; allocated: number }> = {}
      const choresMap: Record<string, number> = {}

      await Promise.all(
        uniqueKids.map(async (kid: any) => {
          try {
            const goalsSnap = await getDocs(collection(db, 'kids', kid.id, 'goals'))
            const activeGoals = goalsSnap.docs
              .map((d) => d.data())
              .filter((g) => !g.completed && g.status !== 'completed')
            const allocated = activeGoals.reduce(
              (sum, g) => sum + Number(g.currentAmount ?? g.savedAmount ?? 0),
              0
            )
            statsMap[kid.id] = { count: activeGoals.length, allocated }

            const choresSnap = await getDocs(collection(db, 'kids', kid.id, 'chores'))
            const pending = choresSnap.docs.filter(
              (d) => d.data()?.status === 'pending_approval'
            ).length
            choresMap[kid.id] = pending
          } catch {
            statsMap[kid.id] = { count: 0, allocated: 0 }
            choresMap[kid.id] = 0
          }
        })
      )

      setSubAccountStats(statsMap)
      setPendingChoreCount(choresMap)
    } catch (err) {
      console.error('Error fetching kids:', err)
    }
  }

  const handleQuickTransaction = async (e: React.FormEvent, kid: any) => {
    e.preventDefault()
    const amt = parseFloat(quickAmount)
    if (!amt || amt <= 0 || !quickDesc.trim()) return

    const finalAmount = quickType === 'debit' ? -Math.abs(amt) : Math.abs(amt)
    const nextTotal = Number((Number(kid.total || 0) + finalAmount).toFixed(2))

    setQuickSaving(true)
    try {
      await addDoc(collection(db, 'kids', kid.id, 'transactions'), {
        amount: finalAmount,
        description: quickDesc.trim(),
        date: serverTimestamp(),
        parentName: user?.displayName || 'Parent',
        parentEmail: user?.email || '',
      })
      await updateDoc(doc(db, 'kids', kid.id), {
        total: nextTotal,
      })

      setKids((prev) => prev.map((k) => (k.id === kid.id ? { ...k, total: nextTotal } : k)))
      setQuickTxKidId(null)
      setQuickAmount('')
      setQuickDesc('')
    } catch (err) {
      console.error('Error adding quick transaction:', err)
      alert('Failed to record transaction.')
    } finally {
      setQuickSaving(false)
    }
  }

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({
      prompt: 'select_account',
    })

    try {
      const result = await signInWithPopup(auth, provider)
      const idToken = await result.user.getIdToken()

      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
        credentials: 'include',
      })

      if (response.ok) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        const urlParams = new URLSearchParams(window.location.search)
        const redirect = urlParams.get('redirect')
        if (redirect) {
          router.push(redirect)
        } else {
          router.refresh()
        }
      } else {
        alert('Failed to create session. Please try again.')
      }
    } catch (error) {
      console.error('Error signing in with Google:', error)
      alert('Failed to sign in. Please try again.')
    }
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-3xl shadow-md border border-gray-200 text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl mx-auto mb-4">
          🏦
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Parent Bank Sign In</h1>
        <p className="text-sm text-gray-600 mb-6">
          Sign in with Google to manage your children&apos;s allowances, sub-account savings jars,
          chores, and parent interest.
        </p>
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
        >
          <span>Sign in with Google</span>
          <span>→</span>
        </button>
      </div>
    )
  }

  const totalFamilyBalance = kids.reduce((sum, k) => sum + Number(k.total || 0), 0)
  const totalFamilySaved = Object.values(subAccountStats).reduce((s, v) => s + v.allocated, 0)
  const totalFamilyChecking = totalFamilyBalance - totalFamilySaved

  return (
    <div className="space-y-8">
      {/* Header Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full mb-1">
            🏦 Bank of Mom &amp; Dad HQ
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900">Parent Dashboard</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Signed in as {user.displayName} ({user.email})
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/parent/contributions"
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors"
          >
            📊 Parent Contributions
          </Link>
          <Link
            href="/parent/ai-bot"
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors"
          >
            🤖 Grokbot &amp; AI API
          </Link>
          <button
            onClick={() => setShowAddKidForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl text-sm shadow-sm transition-colors"
          >
            ＋ Add New Kid
          </button>
        </div>
      </div>

      {/* Family Bank Summary Bar */}
      {kids.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Total Family Bank Liability
            </span>
            <p className="text-3xl font-extrabold mt-1">${totalFamilyBalance.toFixed(2)}</p>
            <p className="text-xs text-slate-300 mt-1">
              Across {kids.length} child account{kids.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Total Available Checking
            </span>
            <p className="text-3xl font-extrabold text-emerald-900 mt-1">
              ${totalFamilyChecking.toFixed(2)}
            </p>
            <p className="text-xs text-emerald-700 mt-1">Unallocated everyday spending money</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 p-5 rounded-2xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-700">
              Total Earmarked in Sub-Accounts
            </span>
            <p className="text-3xl font-extrabold text-purple-900 mt-1">
              ${totalFamilySaved.toFixed(2)}
            </p>
            <p className="text-xs text-purple-700 mt-1">Saved in goals &amp; savings jars</p>
          </div>
        </div>
      )}

      {/* Kids Grid */}
      {kids.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-200">
          <div className="text-4xl mb-3">👧 👦 🐷</div>
          <p className="text-xl font-bold text-gray-900 mb-2">No kids added yet</p>
          <p className="text-sm text-gray-600 mb-6">
            Create your first child&apos;s account to start tracking allowances, sub-accounts, and
            savings goals.
          </p>
          <button
            onClick={() => setShowAddKidForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl"
          >
            ＋ Add Your First Kid
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {kids.map((kid: any) => {
            const sub = subAccountStats[kid.id] || { count: 0, allocated: 0 }
            const total = Number(kid.total || 0)
            const checking = total - sub.allocated
            const pendingChores = pendingChoreCount[kid.id] || 0
            const isQuickOpen = quickTxKidId === kid.id

            return (
              <div
                key={kid.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <Link
                        href={`/parent/kid/${kid.slug}`}
                        className="text-2xl font-extrabold text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {kid.name}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {kid.parentId === user.uid ? 'Account Owner' : 'Shared Family Access'} · /
                        {kid.slug}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        kid.public
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {kid.public ? 'Public Link' : 'Private'}
                    </span>
                  </div>

                  {/* Balances */}
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 mb-4 space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-semibold uppercase text-gray-500">
                        Total Balance
                      </span>
                      <span className="text-2xl font-extrabold text-gray-900">
                        ${total.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 pt-2 border-t border-gray-200/70">
                      <span>Checking: ${checking.toFixed(2)}</span>
                      <span className="font-semibold text-purple-700">
                        🐷 {sub.count} Sub-Account{sub.count === 1 ? '' : 's'} ($
                        {sub.allocated.toFixed(2)})
                      </span>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {kid.weeklyAllowance > 0 && (
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-medium">
                        💵 ${Number(kid.weeklyAllowance).toFixed(2)}/{kid.allowanceDay || 'wk'}
                      </span>
                    )}
                    {kid.interestRateMonthly > 0 && (
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium">
                        📈 {kid.interestRateMonthly}%/mo Interest
                      </span>
                    )}
                    {pendingChores > 0 && (
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold">
                        🔔 {pendingChores} Chore{pendingChores === 1 ? '' : 's'} to Approve
                      </span>
                    )}
                  </div>

                  {/* Inline Quick Transaction Drawer */}
                  {isQuickOpen ? (
                    <form
                      onSubmit={(e) => handleQuickTransaction(e, kid)}
                      className="mb-4 p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="inline-flex p-0.5 bg-white rounded-lg border border-gray-200 text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => setQuickType('debit')}
                            className={`px-2.5 py-1 rounded-md ${
                              quickType === 'debit'
                                ? 'bg-red-600 text-white'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            − Spend
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuickType('credit')}
                            className={`px-2.5 py-1 rounded-md ${
                              quickType === 'credit'
                                ? 'bg-emerald-600 text-white'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            ＋ Add $
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setQuickTxKidId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="$0.00"
                          value={quickAmount}
                          onChange={(e) => setQuickAmount(e.target.value)}
                          className="col-span-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm font-bold bg-white"
                          required
                        />
                        <input
                          type="text"
                          placeholder="What for?"
                          value={quickDesc}
                          onChange={(e) => setQuickDesc(e.target.value)}
                          className="col-span-2 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm bg-white"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={quickSaving}
                        className={`w-full py-2 rounded-lg text-white text-xs font-extrabold ${
                          quickType === 'credit'
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : 'bg-red-600 hover:bg-red-700'
                        }`}
                      >
                        {quickSaving
                          ? 'Saving...'
                          : quickType === 'credit'
                          ? '＋ Record Credit'
                          : '− Record Spend'}
                      </button>
                    </form>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickTxKidId(kid.id)
                          setQuickType('debit')
                          setQuickAmount('')
                          setQuickDesc('')
                        }}
                        className="py-2 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs transition-colors"
                      >
                        − Quick Spend
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickTxKidId(kid.id)
                          setQuickType('credit')
                          setQuickAmount('')
                          setQuickDesc('')
                        }}
                        className="py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs transition-colors"
                      >
                        ＋ Quick Add $
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
                  <Link
                    href={`/parent/kid/${kid.slug}`}
                    className="text-center py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors"
                  >
                    Manage Bank →
                  </Link>
                  <Link
                    href={`/${kid.slug}`}
                    className="text-center py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs transition-colors"
                  >
                    Kid View (/{kid.slug})
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAddKidForm && (
        <AddKidForm
          userId={user.uid}
          userEmail={user.email}
          onClose={() => setShowAddKidForm(false)}
          onSuccess={() => fetchKids(user.uid, user.email || '')}
        />
      )}
    </div>
  )
}
