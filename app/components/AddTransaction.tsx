'use client'

import { useState, useEffect } from 'react'
import { db, auth } from '../lib/firebase'
import {
  doc,
  collection,
  getDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'

interface AddTransactionProps {
  kidId: string
  kidName?: string
  weeklyAllowance?: number
}

const DEBIT_PRESETS = [
  { label: '🧸 Toy / Game', text: 'Toy / Game' },
  { label: '🍦 Snack / Treat', text: 'Snack / Treat' },
  { label: '🛍️ Store Purchase', text: 'Store Purchase' },
  { label: '🎮 Digital / Game', text: 'Digital / Game Purchase' },
  { label: '🎁 Gift for Someone', text: 'Gift' },
]

const CREDIT_PRESETS = [
  { label: '💵 Weekly Allowance', text: 'Weekly Allowance' },
  { label: '🧹 Chore Bonus', text: 'Chore Bonus' },
  { label: '🎂 Gift / Birthday', text: 'Birthday / Gift Money' },
  { label: '🦷 Tooth Fairy', text: 'Tooth Fairy' },
  { label: '💵 Cash Deposit', text: 'Cash Deposit' },
]

const QUICK_AMOUNTS = [1, 2, 5, 10, 20]

export default function AddTransaction({
  kidId,
  kidName,
  weeklyAllowance = 0,
}: AddTransactionProps) {
  const [transaction, setTransaction] = useState({
    amount: '',
    description: '',
    type: 'debit' as 'debit' | 'credit',
    date: new Date().toISOString().split('T')[0],
  })
  const [showCustomDate, setShowCustomDate] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Live balances + auto-split rules
  const [totalBalance, setTotalBalance] = useState<number>(0)
  const [subAccounts, setSubAccounts] = useState<
    { id: string; name: string; currentAmount: number; autoSplitPercent: number }[]
  >([])
  const [autoSplitEnabled, setAutoSplitEnabled] = useState(true)

  useEffect(() => {
    const unsubKid = onSnapshot(doc(db, 'kids', kidId), (snap) => {
      if (snap.exists()) {
        setTotalBalance(Number(snap.data()?.total || 0))
      }
    })

    const unsubGoals = onSnapshot(collection(db, 'kids', kidId, 'goals'), (snap) => {
      const active = snap.docs
        .map((d) => ({
          id: d.id,
          name: d.data().name || 'Sub-Account',
          currentAmount: Number(d.data().currentAmount ?? d.data().savedAmount ?? 0),
          autoSplitPercent: Number(d.data().autoSplitPercent || 0),
          completed: Boolean(d.data().completed || d.data().status === 'completed'),
        }))
        .filter((g) => !g.completed)
      setSubAccounts(active)
    })

    return () => {
      unsubKid()
      unsubGoals()
    }
  }, [kidId])

  const allocatedBalance = subAccounts.reduce((s, a) => s + a.currentAmount, 0)
  const checkingBalance = Number((totalBalance - allocatedBalance).toFixed(2))
  const splitAccounts = subAccounts.filter((a) => a.autoSplitPercent > 0)
  const totalAutoSplitPct = splitAccounts.reduce((s, a) => s + a.autoSplitPercent, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const amount = parseFloat(transaction.amount)
    if (!amount || amount <= 0 || !transaction.description.trim()) return

    const finalAmount = transaction.type === 'debit' ? -Math.abs(amount) : Math.abs(amount)
    const description = transaction.description.trim()

    setIsSubmitting(true)
    try {
      const kidRef = doc(db, 'kids', kidId)
      const kidDoc = await getDoc(kidRef)

      if (!kidDoc.exists()) {
        throw new Error('Kid document does not exist!')
      }

      const currentTotal = Number(kidDoc.data().total || 0)
      const newTotal = Number((currentTotal + finalAmount).toFixed(2))

      const transactionsRef = collection(db, 'kids', kidId, 'transactions')
      await addDoc(transactionsRef, {
        amount: finalAmount,
        description,
        date: serverTimestamp(),
        parentName: auth.currentUser?.displayName || 'Parent',
        parentEmail: auth.currentUser?.email || '',
      })

      await updateDoc(kidRef, {
        total: newTotal,
      })

      // If Credit + Auto-Split is enabled, route percentages into sub-accounts
      let splitSummary = ''
      if (transaction.type === 'credit' && autoSplitEnabled && splitAccounts.length > 0) {
        const parts: string[] = []
        for (const acc of splitAccounts) {
          const share = Number(((amount * acc.autoSplitPercent) / 100).toFixed(2))
          if (share > 0) {
            await updateDoc(doc(db, 'kids', kidId, 'goals', acc.id), {
              currentAmount: Number((acc.currentAmount + share).toFixed(2)),
            })
            parts.push(`$${share.toFixed(2)} → ${acc.name}`)
          }
        }
        if (parts.length > 0) {
          splitSummary = ` (Auto-split: ${parts.join(', ')})`
        }
      }

      setToast(
        `✓ ${finalAmount >= 0 ? `+$${amount.toFixed(2)}` : `-$${amount.toFixed(2)}`} "${description}" recorded · New Total: $${newTotal.toFixed(2)}${splitSummary}`
      )
      setTimeout(() => setToast(null), 5000)

      setTransaction({
        amount: '',
        description: '',
        type: transaction.type,
        date: new Date().toISOString().split('T')[0],
      })
    } catch (err) {
      console.error('Error adding transaction:', err)
      alert('Failed to add transaction. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const parsedAmount = parseFloat(transaction.amount) || 0
  const presets = transaction.type === 'debit' ? DEBIT_PRESETS : CREDIT_PRESETS

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-md border-2 border-blue-100">
      {/* Top Row: Title + Live Balance Summary Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h2 className="text-xl font-extrabold text-gray-900">
              Quick Add Transaction {kidName ? `for ${kidName}` : ''}
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Record spending or add money in seconds — tap a quick amount or description below
          </p>
        </div>

        {/* Live Balance Mini-Bar */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-300 font-semibold">
              Total Balance
            </div>
            <div className="text-lg font-extrabold leading-tight">${totalBalance.toFixed(2)}</div>
          </div>
          <div
            className={`px-3.5 py-2 rounded-xl border text-right ${
              checkingBalance < 0
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider font-semibold opacity-75">
              Checking
            </div>
            <div className="text-lg font-extrabold leading-tight">
              ${checkingBalance.toFixed(2)}
            </div>
          </div>
          {allocatedBalance > 0 && (
            <div className="hidden md:block px-3.5 py-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-right">
              <div className="text-[10px] uppercase tracking-wider font-semibold opacity-75">
                Sub-Accounts
              </div>
              <div className="text-lg font-extrabold leading-tight">
                ${allocatedBalance.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mode Switcher: Spend (Debit) vs Add Money (Credit) */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-100 rounded-xl mb-4">
        <button
          type="button"
          onClick={() => setTransaction((prev) => ({ ...prev, type: 'debit' }))}
          className={`py-2.5 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            transaction.type === 'debit'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span>➖</span>
          <span>Spend / Deduct (Debit)</span>
        </button>
        <button
          type="button"
          onClick={() => setTransaction((prev) => ({ ...prev, type: 'credit' }))}
          className={`py-2.5 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            transaction.type === 'credit'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span>➕</span>
          <span>Add Money (Credit)</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Main Inputs Row: Amount + Description + Submit */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Amount Input */}
          <div className="md:col-span-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
              Amount ($)
            </label>
            <div className="relative">
              <span
                className={`absolute left-3.5 top-1/2 -translate-y-1/2 font-extrabold text-lg ${
                  transaction.type === 'debit' ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                {transaction.type === 'debit' ? '−$' : '+$'}
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={transaction.amount}
                onChange={(e) =>
                  setTransaction({
                    ...transaction,
                    amount: e.target.value,
                  })
                }
                className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl pl-11 pr-3 py-3 text-lg font-extrabold text-gray-900 outline-none"
                placeholder="0.00"
                required
              />
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() =>
                    setTransaction((prev) => ({
                      ...prev,
                      amount: amt.toString(),
                    }))
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                    Number(transaction.amount) === amt
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  ${amt}
                </button>
              ))}
              {weeklyAllowance > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setTransaction((prev) => ({
                      ...prev,
                      type: 'credit',
                      amount: weeklyAllowance.toString(),
                      description: prev.description || 'Weekly Allowance',
                    }))
                  }
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
                >
                  💵 Allowance (${weeklyAllowance})
                </button>
              )}
            </div>
          </div>

          {/* Description Input */}
          <div className="md:col-span-5">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                What is it for?
              </label>
              <button
                type="button"
                onClick={() => setShowCustomDate((v) => !v)}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                {showCustomDate ? 'Hide date' : `📅 Date: Today`}
              </button>
            </div>
            <input
              type="text"
              value={transaction.description}
              onChange={(e) =>
                setTransaction({
                  ...transaction,
                  description: e.target.value,
                })
              }
              className="w-full border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl px-3.5 py-3 text-base font-medium text-gray-900 outline-none"
              placeholder={
                transaction.type === 'debit'
                  ? 'e.g., LEGO set, Ice cream, Toy...'
                  : 'e.g., Weekly Allowance, Grandma gift...'
              }
              required
            />

            {/* Quick Description Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setTransaction((prev) => ({
                      ...prev,
                      description: preset.text,
                    }))
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    transaction.description === preset.text
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="md:col-span-3 flex flex-col justify-start">
            <label className="hidden md:block text-xs font-bold uppercase tracking-wider text-transparent mb-1 select-none">
              Action
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 px-4 rounded-xl text-white font-extrabold text-base shadow-sm transition-all ${
                transaction.type === 'credit'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-red-600 hover:bg-red-700'
              } disabled:opacity-50`}
            >
              {isSubmitting
                ? 'Saving...'
                : transaction.type === 'credit'
                ? `＋ Add ${parsedAmount > 0 ? `$${parsedAmount.toFixed(2)}` : 'Credit'}`
                : `− Spend ${parsedAmount > 0 ? `$${parsedAmount.toFixed(2)}` : 'Debit'}`}
            </button>
          </div>
        </div>

        {/* Optional Custom Date Picker */}
        {showCustomDate && (
          <div className="pt-2 border-t border-gray-100 flex items-center gap-3">
            <label className="text-xs font-semibold text-gray-600">Transaction Date:</label>
            <input
              type="date"
              value={transaction.date}
              onChange={(e) =>
                setTransaction({
                  ...transaction,
                  date: e.target.value,
                })
              }
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              max={new Date().toISOString().split('T')[0]}
              required
            />
          </div>
        )}

        {/* Auto-Split Toggle when adding a Credit and kid has auto-split rules */}
        {transaction.type === 'credit' && totalAutoSplitPct > 0 && (
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-900 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSplitEnabled}
              onChange={(e) => setAutoSplitEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600"
            />
            <span>
              <strong>⚡ Auto-split {totalAutoSplitPct}% into Sub-Accounts</strong> (
              {splitAccounts.map((a) => `${a.autoSplitPercent}% → ${a.name}`).join(', ')})
            </span>
          </label>
        )}
      </form>

      {/* Instant Feedback Toast */}
      {toast && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold text-center shadow-sm">
          {toast}
        </div>
      )}
    </div>
  )
}
