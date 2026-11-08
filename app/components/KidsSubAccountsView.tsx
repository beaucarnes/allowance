'use client'

import { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import { SubAccount, SubAccountColor, SubAccountType } from '../lib/types'

interface KidsSubAccountsViewProps {
  kidId: string
  kidName: string
  allowTransfers?: boolean
}

const COLOR_STYLES: Record<
  SubAccountColor,
  {
    bg: string
    border: string
    badge: string
    bar: string
    text: string
  }
> = {
  blue: {
    bg: 'from-blue-50 to-white',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800',
    bar: 'from-blue-500 to-indigo-500',
    text: 'text-blue-700',
  },
  purple: {
    bg: 'from-purple-50 to-white',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-800',
    bar: 'from-purple-500 to-fuchsia-500',
    text: 'text-purple-700',
  },
  emerald: {
    bg: 'from-emerald-50 to-white',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800',
    bar: 'from-emerald-500 to-teal-500',
    text: 'text-emerald-700',
  },
  amber: {
    bg: 'from-amber-50 to-white',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    bar: 'from-amber-500 to-orange-500',
    text: 'text-amber-700',
  },
  rose: {
    bg: 'from-rose-50 to-white',
    border: 'border-rose-200',
    badge: 'bg-rose-100 text-rose-800',
    bar: 'from-rose-500 to-pink-500',
    text: 'text-rose-700',
  },
  indigo: {
    bg: 'from-indigo-50 to-white',
    border: 'border-indigo-200',
    badge: 'bg-indigo-100 text-indigo-800',
    bar: 'from-indigo-500 to-violet-500',
    text: 'text-indigo-700',
  },
}

const EMOJI_CHOICES = ['🎯', '🚲', '🎮', '🧱', '🐷', '❤️', '📈', '🚗', '🎧', '🎨', '📚', '⚽', '🎁', '🛹']

export default function KidsSubAccountsView({
  kidId,
  kidName,
  allowTransfers = false,
}: KidsSubAccountsViewProps) {
  const [totalBalance, setTotalBalance] = useState<number | null>(null)
  const [canKidTransfer, setCanKidTransfer] = useState<boolean>(allowTransfers)
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([])
  const [loading, setLoading] = useState(true)

  // Kid self-transfer state
  const [transferState, setTransferState] = useState<{
    id: string
    direction: 'in' | 'out'
  } | null>(null)
  const [transferAmount, setTransferAmount] = useState('')
  const [isBusy, setIsBusy] = useState(false)

  // Kid create goal modal
  const [showNewGoal, setShowNewGoal] = useState(false)
  const [newGoal, setNewGoal] = useState({
    name: '',
    icon: '🎯',
    color: 'blue' as SubAccountColor,
    targetAmount: '',
    description: '',
  })

  useEffect(() => {
    const unsubKid = onSnapshot(doc(db, 'kids', kidId), (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setTotalBalance(Number(data?.total || 0))
        setCanKidTransfer(Boolean(allowTransfers && data?.allowKidSubaccountTransfers !== false))
      }
    })

    const q = query(collection(db, 'kids', kidId, 'goals'), orderBy('createdDate', 'desc'))
    const unsubGoals = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            name: data.name || 'Savings Goal',
            type: (data.type as SubAccountType) || (data.targetAmount > 0 ? 'goal' : 'bucket'),
            icon: data.icon || (data.targetAmount > 0 ? '🎯' : '🐷'),
            color: (data.color as SubAccountColor) || 'blue',
            currentAmount: Number(data.currentAmount ?? data.savedAmount ?? 0),
            targetAmount: Number(data.targetAmount || 0),
            autoSplitPercent: Number(data.autoSplitPercent || 0),
            description: data.description || null,
            targetDate: data.targetDate?.toDate ? data.targetDate.toDate() : null,
            completed: Boolean(data.completed || data.status === 'completed'),
            completedDate: data.completedDate?.toDate ? data.completedDate.toDate() : null,
            createdDate: data.createdDate?.toDate ? data.createdDate.toDate() : new Date(),
          } as SubAccount
        })
        setSubAccounts(list)
        setLoading(false)
      },
      (err) => {
        console.error('Error loading kid sub-accounts:', err)
        setLoading(false)
      }
    )

    return () => {
      unsubKid()
      unsubGoals()
    }
  }, [kidId, allowTransfers])

  if (loading || totalBalance === null) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 bg-gray-100 rounded-xl"></div>
          <div className="h-24 bg-gray-100 rounded-xl"></div>
          <div className="h-24 bg-gray-100 rounded-xl"></div>
        </div>
      </div>
    )
  }

  const activeAccounts = subAccounts.filter((a) => !a.completed)
  const completedAccounts = subAccounts.filter((a) => a.completed)
  const totalAllocated = activeAccounts.reduce((sum, a) => sum + (a.currentAmount || 0), 0)
  const spendableBalance = Number((totalBalance - totalAllocated).toFixed(2))

  const handleKidTransfer = async (acc: SubAccount) => {
    if (!transferState) return
    const raw = parseFloat(transferAmount)
    if (!raw || raw <= 0) return
    const amount = Number(raw.toFixed(2))

    if (transferState.direction === 'in' && amount > Math.max(0, spendableBalance)) {
      alert(`You only have $${Math.max(0, spendableBalance).toFixed(2)} in Available Spending Money!`)
      return
    }
    if (transferState.direction === 'out' && amount > acc.currentAmount) {
      alert(`You only have $${acc.currentAmount.toFixed(2)} in "${acc.name}"!`)
      return
    }

    setIsBusy(true)
    try {
      const next =
        transferState.direction === 'in'
          ? Number((acc.currentAmount + amount).toFixed(2))
          : Number((acc.currentAmount - amount).toFixed(2))
      await updateDoc(doc(db, 'kids', kidId, 'goals', acc.id), {
        currentAmount: next,
      })
      setTransferState(null)
      setTransferAmount('')
    } catch (err) {
      console.error('Error transferring between sub-accounts:', err)
      alert('Could not move money right now. Ask a parent to help!')
    } finally {
      setIsBusy(false)
    }
  }

  const handleCreateWishlistGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGoal.name.trim()) return
    const target = parseFloat(newGoal.targetAmount) || 0

    setIsBusy(true)
    try {
      await addDoc(collection(db, 'kids', kidId, 'goals'), {
        name: newGoal.name.trim(),
        type: target > 0 ? 'goal' : 'bucket',
        icon: newGoal.icon,
        color: newGoal.color,
        currentAmount: 0,
        targetAmount: Math.max(0, target),
        autoSplitPercent: 0,
        description: newGoal.description.trim() || null,
        targetDate: null,
        completed: false,
        createdDate: serverTimestamp(),
      })
      setShowNewGoal(false)
      setNewGoal({
        name: '',
        icon: '🎯',
        color: 'blue',
        targetAmount: '',
        description: '',
      })
    } catch (err) {
      console.error('Error creating kid goal:', err)
      alert('Ask a parent to sign in to create a new goal!')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Hero Bank Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-5 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                Total Bank Balance
              </span>
              <span className="text-xl">🏦</span>
            </div>
            <p className="text-3xl font-extrabold">${totalBalance.toFixed(2)}</p>
            <p className="text-xs text-blue-100 mt-1">All your money combined</p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Available to Spend
              </span>
              <span className="text-xl">💵</span>
            </div>
            <p
              className={`text-3xl font-extrabold ${
                spendableBalance >= 0 ? 'text-emerald-900' : 'text-red-700'
              }`}
            >
              ${spendableBalance.toFixed(2)}
            </p>
            <p className="text-xs text-emerald-700 mt-1">Ready in your checking account</p>
          </div>

          <div className="bg-purple-50 border border-purple-200 p-5 rounded-2xl">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-700">
                Saved in Sub-Accounts
              </span>
              <span className="text-xl">🐷</span>
            </div>
            <p className="text-3xl font-extrabold text-purple-900">
              ${totalAllocated.toFixed(2)}
            </p>
            <p className="text-xs text-purple-700 mt-1">
              Across {activeAccounts.length} savings jar{activeAccounts.length === 1 ? '' : 's'} &amp; goals
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Accounts & Savings Goals Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              🎯 {kidName}&apos;s Sub-Accounts &amp; Savings Jars
            </h2>
            <p className="text-sm text-gray-600">
              Save money in separate jars for special goals, future plans, or giving!
            </p>
          </div>
          {canKidTransfer && (
            <button
              onClick={() => setShowNewGoal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl text-sm transition-colors self-start sm:self-auto"
            >
              ＋ Add Savings Goal / Jar
            </button>
          )}
        </div>

        {activeAccounts.length === 0 ? (
          <div className="text-center py-8 bg-gradient-to-b from-blue-50/50 to-white rounded-2xl border border-dashed border-blue-200 p-6">
            <div className="text-4xl mb-2">🐷 🚀 🎮</div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              No Sub-Accounts or Savings Goals Yet!
            </h3>
            <p className="text-sm text-gray-600 max-w-md mx-auto mb-4">
              Create sub-accounts to save for things you want — like a new game, LEGO set, bike, or a
              Long-Term Savings jar!
            </p>
            {canKidTransfer && (
              <button
                onClick={() => setShowNewGoal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl text-sm"
              >
                Create Your First Savings Jar
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeAccounts.map((acc) => {
              const style = COLOR_STYLES[acc.color] || COLOR_STYLES.blue
              const isGoal = acc.type === 'goal' && acc.targetAmount > 0
              const pct = isGoal
                ? Math.min(100, (acc.currentAmount / acc.targetAmount) * 100)
                : 100
              const remaining = isGoal ? Math.max(0, acc.targetAmount - acc.currentAmount) : 0
              const isTransferOpen = transferState?.id === acc.id

              return (
                <div
                  key={acc.id}
                  className={`rounded-2xl border-2 p-5 bg-gradient-to-br ${style.bg} ${style.border} flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{acc.icon}</span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-bold text-gray-900">{acc.name}</h3>
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}
                            >
                              {isGoal ? 'Goal' : 'Savings Jar'}
                            </span>
                          </div>
                          {acc.description && (
                            <p className="text-xs text-gray-600 mt-0.5">{acc.description}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="my-3">
                      <div className="flex items-baseline justify-between mb-1.5">
                        <div>
                          <span className="text-2xl font-extrabold text-gray-900">
                            ${acc.currentAmount.toFixed(2)}
                          </span>
                          {isGoal && (
                            <span className="text-sm text-gray-500 ml-1.5">
                              of ${acc.targetAmount.toFixed(2)}
                            </span>
                          )}
                        </div>
                        {isGoal && (
                          <span className={`text-sm font-extrabold ${style.text}`}>
                            {pct.toFixed(0)}%
                          </span>
                        )}
                      </div>

                      {isGoal && (
                        <>
                          <div className="w-full bg-gray-200 rounded-full h-3.5 overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${style.bar} transition-all duration-500`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          {/* Milestones */}
                          <div className="flex justify-between text-[11px] text-gray-500 mt-2">
                            <span className={pct >= 25 ? 'text-emerald-700 font-bold' : ''}>
                              {pct >= 25 ? '🌟' : '⚪'} 25%
                            </span>
                            <span className={pct >= 50 ? 'text-emerald-700 font-bold' : ''}>
                              {pct >= 50 ? '🎯' : '⚪'} 50%
                            </span>
                            <span className={pct >= 75 ? 'text-emerald-700 font-bold' : ''}>
                              {pct >= 75 ? '⭐' : '⚪'} 75%
                            </span>
                            <span className={pct >= 100 ? 'text-emerald-700 font-bold' : ''}>
                              {pct >= 100 ? '🏆' : '⚪'} Goal!
                            </span>
                          </div>

                          <p className="text-xs font-medium text-gray-700 mt-2">
                            {remaining <= 0
                              ? '🎉 Goal Reached! Ask your parents when you are ready to buy it!'
                              : `Only $${remaining.toFixed(2)} more to reach your goal!`}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Kid Self-Service Transfer Controls */}
                  {canKidTransfer && (
                    <div className="pt-3 border-t border-gray-200/70 mt-2">
                      {isTransferOpen ? (
                        <div className="space-y-2 bg-white/90 p-3 rounded-xl border border-gray-200">
                          <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                            <span>
                              {transferState.direction === 'in'
                                ? `Save from Available ($${Math.max(0, spendableBalance).toFixed(2)})`
                                : `Move back to Available ($${acc.currentAmount.toFixed(2)})`}
                            </span>
                            <button
                              onClick={() => {
                                setTransferState(null)
                                setTransferAmount('')
                              }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={transferAmount}
                              onChange={(e) => setTransferAmount(e.target.value)}
                              placeholder="0.00"
                              className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm"
                            />
                            <button
                              disabled={isBusy || !transferAmount || parseFloat(transferAmount) <= 0}
                              onClick={() => handleKidTransfer(acc)}
                              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs"
                            >
                              Move Money
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            disabled={spendableBalance <= 0}
                            onClick={() => {
                              setTransferState({ id: acc.id, direction: 'in' })
                              setTransferAmount('')
                            }}
                            className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-blue-50 border border-gray-200 text-blue-700 font-bold text-xs disabled:opacity-40 transition-colors shadow-sm"
                          >
                            ＋ Add to Jar
                          </button>
                          <button
                            disabled={acc.currentAmount <= 0}
                            onClick={() => {
                              setTransferState({ id: acc.id, direction: 'out' })
                              setTransferAmount('')
                            }}
                            className="py-2 px-3 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-semibold text-xs disabled:opacity-40 transition-colors"
                          >
                            ⇄ Move Out
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {completedAccounts.length > 0 && (
          <div className="mt-6 pt-5 border-t border-gray-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-700 mb-3">
              🏆 Completed Goals ({completedAccounts.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {completedAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5"
                >
                  <span className="text-2xl">{acc.icon}</span>
                  <div>
                    <p className="font-bold text-sm text-emerald-950">{acc.name}</p>
                    <p className="text-xs text-emerald-700">
                      ${acc.targetAmount.toFixed(2)} Goal Accomplished! 🎉
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Kid Create Goal Modal */}
      {showNewGoal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">🎯 New Savings Goal or Jar</h3>
              <button
                onClick={() => setShowNewGoal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateWishlistGoal} className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Icon</label>
                  <select
                    value={newGoal.icon}
                    onChange={(e) => setNewGoal({ ...newGoal, icon: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-2 py-2 text-lg"
                  >
                    {EMOJI_CHOICES.map((em) => (
                      <option key={em} value={em}>
                        {em}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    What are you saving for? *
                  </label>
                  <input
                    type="text"
                    value={newGoal.name}
                    onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                    placeholder="e.g., LEGO Set, Bike, Savings Jar"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Target Amount ($) (Leave blank for an open Savings Jar)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newGoal.targetAmount}
                  onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
                  placeholder="50.00"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Why do you want this? (Optional)
                </label>
                <input
                  type="text"
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                  placeholder="e.g., To play with friends!"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewGoal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm"
                >
                  {isBusy ? 'Creating...' : 'Create Jar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
