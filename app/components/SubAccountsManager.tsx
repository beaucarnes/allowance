'use client'

import { useState, useEffect } from 'react'
import { db, auth } from '../lib/firebase'
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment,
  query,
  orderBy,
} from 'firebase/firestore'
import { SubAccount, SubAccountColor, SubAccountType } from '../lib/types'

interface SubAccountsManagerProps {
  kidId: string
  kidName: string
  weeklyAllowance?: number
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
    bg: 'bg-blue-50/70',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800',
    bar: 'bg-blue-500',
    text: 'text-blue-700',
  },
  purple: {
    bg: 'bg-purple-50/70',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-800',
    bar: 'bg-purple-500',
    text: 'text-purple-700',
  },
  emerald: {
    bg: 'bg-emerald-50/70',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800',
    bar: 'bg-emerald-500',
    text: 'text-emerald-700',
  },
  amber: {
    bg: 'bg-amber-50/70',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    bar: 'bg-amber-500',
    text: 'text-amber-700',
  },
  rose: {
    bg: 'bg-rose-50/70',
    border: 'border-rose-200',
    badge: 'bg-rose-100 text-rose-800',
    bar: 'bg-rose-500',
    text: 'text-rose-700',
  },
  indigo: {
    bg: 'bg-indigo-50/70',
    border: 'border-indigo-200',
    badge: 'bg-indigo-100 text-indigo-800',
    bar: 'bg-indigo-500',
    text: 'text-indigo-700',
  },
}

const PRESET_TEMPLATES: {
  name: string
  type: SubAccountType
  icon: string
  color: SubAccountColor
  targetAmount: number
  autoSplitPercent: number
  description: string
}[] = [
  {
    name: 'Long-Term Savings',
    type: 'bucket',
    icon: '🐷',
    color: 'emerald',
    targetAmount: 0,
    autoSplitPercent: 20,
    description: 'Rainy day & future big purchases sub-account',
  },
  {
    name: 'Giving & Charity',
    type: 'bucket',
    icon: '❤️',
    color: 'rose',
    targetAmount: 0,
    autoSplitPercent: 10,
    description: 'Money set aside to help others and give gifts',
  },
  {
    name: 'Future / Invest Jar',
    type: 'bucket',
    icon: '📈',
    color: 'indigo',
    targetAmount: 0,
    autoSplitPercent: 10,
    description: 'Long-term wealth & compound interest bucket',
  },
  {
    name: 'New Bike',
    type: 'goal',
    icon: '🚲',
    color: 'blue',
    targetAmount: 150,
    autoSplitPercent: 0,
    description: 'Saving up for a brand new bike!',
  },
  {
    name: 'Video Game',
    type: 'goal',
    icon: '🎮',
    color: 'purple',
    targetAmount: 60,
    autoSplitPercent: 0,
    description: 'Next favorite game',
  },
  {
    name: 'LEGO Set',
    type: 'goal',
    icon: '🧱',
    color: 'amber',
    targetAmount: 80,
    autoSplitPercent: 0,
    description: 'Special LEGO build goal',
  },
]

const EMOJI_CHOICES = ['🐷', '🎯', '🚲', '🎮', '🧱', '❤️', '📈', '🚗', '🎧', '🎨', '📚', '⚽', '🏖️', '🎁', '💻', '🛹']

export default function SubAccountsManager({
  kidId,
  kidName,
  weeklyAllowance = 0,
}: SubAccountsManagerProps) {
  const [totalBalance, setTotalBalance] = useState<number>(0)
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Modal state for Create / Edit
  const [showModal, setShowModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<SubAccount | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'goal' as SubAccountType,
    icon: '🎯',
    color: 'blue' as SubAccountColor,
    targetAmount: '',
    autoSplitPercent: '0',
    description: '',
    targetDate: '',
    initialAmount: '',
  })

  // Active card action state
  const [activeAction, setActiveAction] = useState<{
    id: string
    mode: 'deposit' | 'withdraw' | 'spend'
  } | null>(null)
  const [actionAmount, setActionAmount] = useState('')
  const [actionNote, setActionNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auto-split modal state
  const [showSplitModal, setShowSplitModal] = useState(false)
  const [splitBaseAmount, setSplitBaseAmount] = useState('')

  useEffect(() => {
    const unsubKid = onSnapshot(doc(db, 'kids', kidId), (snap) => {
      if (snap.exists()) {
        setTotalBalance(Number(snap.data()?.total || 0))
      }
    })

    const goalsRef = collection(db, 'kids', kidId, 'goals')
    const q = query(goalsRef, orderBy('createdDate', 'desc'))
    const unsubGoals = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            name: data.name || 'Sub-Account',
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
            createdDate: data.createdDate?.toDate
              ? data.createdDate.toDate()
              : data.createdAt?.toDate
              ? data.createdAt.toDate()
              : new Date(),
          } as SubAccount
        })
        setSubAccounts(list)
        setIsLoading(false)
      },
      (err) => {
        console.error('Error listening to sub-accounts:', err)
        setIsLoading(false)
      }
    )

    return () => {
      unsubKid()
      unsubGoals()
    }
  }, [kidId])

  const activeAccounts = subAccounts.filter((a) => !a.completed)
  const completedAccounts = subAccounts.filter((a) => a.completed)
  const totalAllocated = activeAccounts.reduce((sum, a) => sum + (a.currentAmount || 0), 0)
  const spendableBalance = Number((totalBalance - totalAllocated).toFixed(2))
  const totalAutoSplitPercent = activeAccounts.reduce((sum, a) => sum + (a.autoSplitPercent || 0), 0)

  const openCreateModal = (preset?: (typeof PRESET_TEMPLATES)[0]) => {
    setEditingAccount(null)
    if (preset) {
      setFormData({
        name: preset.name,
        type: preset.type,
        icon: preset.icon,
        color: preset.color,
        targetAmount: preset.targetAmount > 0 ? preset.targetAmount.toString() : '',
        autoSplitPercent: preset.autoSplitPercent.toString(),
        description: preset.description,
        targetDate: '',
        initialAmount: '',
      })
    } else {
      setFormData({
        name: '',
        type: 'goal',
        icon: '🎯',
        color: 'blue',
        targetAmount: '',
        autoSplitPercent: '0',
        description: '',
        targetDate: '',
        initialAmount: '',
      })
    }
    setShowModal(true)
  }

  const openEditModal = (account: SubAccount) => {
    setEditingAccount(account)
    setFormData({
      name: account.name,
      type: account.type,
      icon: account.icon,
      color: account.color,
      targetAmount: account.targetAmount > 0 ? account.targetAmount.toString() : '',
      autoSplitPercent: (account.autoSplitPercent || 0).toString(),
      description: account.description || '',
      targetDate: account.targetDate ? account.targetDate.toISOString().split('T')[0] : '',
      initialAmount: '',
    })
    setShowModal(true)
  }

  const handleSaveSubAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    const targetAmount =
      formData.type === 'goal' ? Math.max(0, parseFloat(formData.targetAmount) || 0) : 0
    if (formData.type === 'goal' && targetAmount <= 0) {
      alert('Please enter a target amount greater than $0 for a savings goal, or switch to an ongoing Sub-Account Bucket.')
      return
    }

    const autoSplitPercent = Math.min(100, Math.max(0, parseFloat(formData.autoSplitPercent) || 0))
    const initialAmount = !editingAccount ? Math.max(0, parseFloat(formData.initialAmount) || 0) : 0

    if (!editingAccount && initialAmount > Math.max(0, spendableBalance)) {
      alert(`Initial transfer ($${initialAmount.toFixed(2)}) cannot exceed Available Checking ($${Math.max(0, spendableBalance).toFixed(2)}).`)
      return
    }

    setIsSubmitting(true)
    try {
      const payload: Record<string, any> = {
        name: formData.name.trim(),
        type: formData.type,
        icon: formData.icon || '🐷',
        color: formData.color || 'blue',
        targetAmount,
        autoSplitPercent,
        description: formData.description.trim() || null,
        targetDate: formData.targetDate ? new Date(formData.targetDate) : null,
      }

      if (editingAccount) {
        await updateDoc(doc(db, 'kids', kidId, 'goals', editingAccount.id), payload)
      } else {
        await addDoc(collection(db, 'kids', kidId, 'goals'), {
          ...payload,
          currentAmount: initialAmount,
          completed: false,
          createdDate: serverTimestamp(),
        })
      }
      setShowModal(false)
      setEditingAccount(null)
    } catch (err) {
      console.error('Error saving sub-account:', err)
      alert('Failed to save sub-account. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCardAction = async (account: SubAccount) => {
    if (!activeAction) return
    const rawAmount = parseFloat(actionAmount)
    if (!rawAmount || rawAmount <= 0) return

    const amount = Number(rawAmount.toFixed(2))
    setIsSubmitting(true)

    try {
      const goalRef = doc(db, 'kids', kidId, 'goals', account.id)

      if (activeAction.mode === 'deposit') {
        if (amount > Math.max(0, spendableBalance)) {
          alert(`Not enough in Available Checking ($${Math.max(0, spendableBalance).toFixed(2)} available).`)
          setIsSubmitting(false)
          return
        }
        const nextAmount = Number((account.currentAmount + amount).toFixed(2))
        await updateDoc(goalRef, {
          currentAmount: nextAmount,
        })
      } else if (activeAction.mode === 'withdraw') {
        if (amount > account.currentAmount) {
          alert(`Cannot withdraw more than the $${account.currentAmount.toFixed(2)} saved in "${account.name}".`)
          setIsSubmitting(false)
          return
        }
        const nextAmount = Number((account.currentAmount - amount).toFixed(2))
        await updateDoc(goalRef, {
          currentAmount: nextAmount,
        })
      } else if (activeAction.mode === 'spend') {
        if (amount > account.currentAmount) {
          alert(`Cannot spend more than the $${account.currentAmount.toFixed(2)} saved in "${account.name}".`)
          setIsSubmitting(false)
          return
        }
        const nextSubAmount = Number((account.currentAmount - amount).toFixed(2))
        const reachedGoal = account.type === 'goal' && account.currentAmount >= account.targetAmount && nextSubAmount === 0
        const description = actionNote.trim()
          ? `[${account.name}] ${actionNote.trim()}`
          : `Spent from ${account.name}`

        // 1. Record the debit transaction on the main ledger
        await addDoc(collection(db, 'kids', kidId, 'transactions'), {
          amount: -amount,
          description,
          date: serverTimestamp(),
          parentName: auth.currentUser?.displayName || 'Parent',
          parentEmail: auth.currentUser?.email || '',
          category: 'goal_purchase',
          subAccountId: account.id,
          subAccountName: account.name,
        })

        // 2. Deduct from kid's total balance
        await updateDoc(doc(db, 'kids', kidId), {
          total: increment(-amount),
        })

        // 3. Deduct from sub-account (and mark complete if it was a goal fully spent)
        await updateDoc(goalRef, {
          currentAmount: nextSubAmount,
          ...(reachedGoal ? { completed: true, completedDate: serverTimestamp() } : {}),
        })
      }

      setActiveAction(null)
      setActionAmount('')
      setActionNote('')
    } catch (err) {
      console.error('Error performing sub-account action:', err)
      alert('Operation failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSubAccount = async (account: SubAccount) => {
    const msg =
      account.currentAmount > 0
        ? `Delete "${account.name}"? Its $${account.currentAmount.toFixed(2)} balance will be returned to ${kidName}'s Available Checking balance.`
        : `Delete "${account.name}"?`
    if (!confirm(msg)) return

    try {
      await deleteDoc(doc(db, 'kids', kidId, 'goals', account.id))
    } catch (err) {
      console.error('Error deleting sub-account:', err)
      alert('Failed to delete sub-account.')
    }
  }

  const handleAutoSplitDistribute = async (e: React.FormEvent) => {
    e.preventDefault()
    const baseAmount = parseFloat(splitBaseAmount)
    if (!baseAmount || baseAmount <= 0) return

    const rulesAccounts = activeAccounts.filter((a) => a.autoSplitPercent > 0)
    const totalNeeded = rulesAccounts.reduce(
      (sum, a) => sum + Number(((baseAmount * a.autoSplitPercent) / 100).toFixed(2)),
      0
    )

    if (totalNeeded > Math.max(0, spendableBalance)) {
      alert(
        `Splitting $${baseAmount.toFixed(2)} requires $${totalNeeded.toFixed(2)} from Available Checking, but only $${Math.max(0, spendableBalance).toFixed(2)} is unallocated.`
      )
      return
    }

    setIsSubmitting(true)
    try {
      for (const acc of rulesAccounts) {
        const share = Number(((baseAmount * acc.autoSplitPercent) / 100).toFixed(2))
        if (share > 0) {
          await updateDoc(doc(db, 'kids', kidId, 'goals', acc.id), {
            currentAmount: Number((acc.currentAmount + share).toFixed(2)),
          })
        }
      }
      setShowSplitModal(false)
      setSplitBaseAmount('')
    } catch (err) {
      console.error('Error auto-splitting:', err)
      alert('Failed to distribute funds.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
        <div className="h-7 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 bg-gray-100 rounded-xl"></div>
          <div className="h-24 bg-gray-100 rounded-xl"></div>
          <div className="h-24 bg-gray-100 rounded-xl"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Main Bank Account & Sub-Accounts Overview Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-2">
              <span>🏦</span>
              <span>Bank of Mom &amp; Dad Account Structure</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {kidName}&apos;s Balances &amp; Sub-Accounts
            </h2>
            <p className="text-sm text-gray-600">
              Divide {kidName}&apos;s total balance into dedicated savings jars, goals, and checking
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {totalAutoSplitPercent > 0 && spendableBalance > 0 && (
              <button
                onClick={() => {
                  setSplitBaseAmount(
                    weeklyAllowance > 0 && weeklyAllowance <= spendableBalance
                      ? weeklyAllowance.toFixed(2)
                      : spendableBalance.toFixed(2)
                  )
                  setShowSplitModal(true)
                }}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors flex items-center gap-2 border border-indigo-200"
              >
                <span>⚡</span>
                <span>Auto-Split ({totalAutoSplitPercent}%)</span>
              </button>
            )}
            <button
              onClick={() => openCreateModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors flex items-center gap-2 shadow-sm"
            >
              <span>＋</span>
              <span>New Sub-Account / Goal</span>
            </button>
          </div>
        </div>

        {/* 3-Column Balance Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Total Balance */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs uppercase tracking-wider text-slate-300 font-semibold">
                Total Bank Balance
              </span>
              <span className="text-lg">🏦</span>
            </div>
            <p className="text-3xl font-extrabold">${totalBalance.toFixed(2)}</p>
            <p className="text-xs text-slate-300 mt-1">
              Checking + all {activeAccounts.length} sub-account{activeAccounts.length === 1 ? '' : 's'}
            </p>
          </div>

          {/* Available Checking */}
          <div
            className={`p-5 rounded-xl border ${
              spendableBalance < 0
                ? 'bg-red-50 border-red-200'
                : 'bg-emerald-50/70 border-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className={`text-xs uppercase tracking-wider font-semibold ${
                  spendableBalance < 0 ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                Available to Spend (Checking)
              </span>
              <span className="text-lg">💳</span>
            </div>
            <p
              className={`text-3xl font-extrabold ${
                spendableBalance < 0 ? 'text-red-900' : 'text-emerald-900'
              }`}
            >
              ${spendableBalance.toFixed(2)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Unallocated money ready for everyday spending
            </p>
          </div>

          {/* Saved in Sub-Accounts */}
          <div className="bg-purple-50/70 border border-purple-200 p-5 rounded-xl">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs uppercase tracking-wider font-semibold text-purple-700">
                Saved in Sub-Accounts
              </span>
              <span className="text-lg">🐷</span>
            </div>
            <p className="text-3xl font-extrabold text-purple-900">
              ${totalAllocated.toFixed(2)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {totalBalance > 0
                ? `${Math.min(100, Math.round((totalAllocated / totalBalance) * 100))}% of total balance earmarked`
                : 'Move money into jars or goals below'}
            </p>
          </div>
        </div>

        {/* Visual Stacked Allocation Bar */}
        {totalBalance > 0 && (
          <div>
            <div className="flex justify-between text-xs font-medium text-gray-600 mb-1.5">
              <span>Account Allocation Breakdown</span>
              <span>
                Checking: ${Math.max(0, spendableBalance).toFixed(2)} · Sub-Accounts: $
                {totalAllocated.toFixed(2)}
              </span>
            </div>
            <div className="w-full h-3.5 bg-gray-100 rounded-full overflow-hidden flex border border-gray-200">
              {activeAccounts.map((acc) => {
                const pct = Math.max(0, Math.min(100, (acc.currentAmount / totalBalance) * 100))
                if (pct <= 0) return null
                const style = COLOR_STYLES[acc.color] || COLOR_STYLES.blue
                return (
                  <div
                    key={acc.id}
                    style={{ width: `${pct}%` }}
                    title={`${acc.icon} ${acc.name}: $${acc.currentAmount.toFixed(2)}`}
                    className={`${style.bar} h-full transition-all duration-300 border-r border-white/50`}
                  />
                )
              })}
              {spendableBalance > 0 && (
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, (spendableBalance / totalBalance) * 100))}%`,
                  }}
                  title={`Available Checking: $${spendableBalance.toFixed(2)}`}
                  className="bg-emerald-400 h-full transition-all duration-300"
                />
              )}
            </div>
            {activeAccounts.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-2.5 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                  Checking (${Math.max(0, spendableBalance).toFixed(2)})
                </span>
                {activeAccounts.map((acc) => {
                  const style = COLOR_STYLES[acc.color] || COLOR_STYLES.blue
                  return (
                    <span key={acc.id} className="inline-flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${style.bar} inline-block`}></span>
                      {acc.icon} {acc.name} (${acc.currentAmount.toFixed(2)})
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Starter Templates when no sub-accounts exist */}
      {subAccounts.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-dashed border-gray-300 text-center">
          <div className="text-4xl mb-3">🐷 🎯 ❤️</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Create {kidName}&apos;s First Sub-Account or Savings Goal
          </h3>
          <p className="text-gray-600 max-w-lg mx-auto mb-6 text-sm">
            Sub-accounts let {kidName} divide their allowance into dedicated buckets (like{' '}
            <strong>Long-Term Savings</strong> or <strong>Giving</strong>) and specific{' '}
            <strong>Savings Goals</strong> (like a bike, LEGO set, or game).
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {PRESET_TEMPLATES.map((preset) => (
              <button
                key={preset.name}
                onClick={() => openCreateModal(preset)}
                className="px-3.5 py-2 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 text-sm font-medium text-gray-800 transition-colors flex items-center gap-2 bg-gray-50/60"
              >
                <span>{preset.icon}</span>
                <span>{preset.name}</span>
                {preset.targetAmount > 0 ? (
                  <span className="text-xs text-gray-500">(${preset.targetAmount})</span>
                ) : (
                  <span className="text-xs text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                    Bucket
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => openCreateModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl text-sm transition-colors shadow-sm"
          >
            + Create Custom Sub-Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeAccounts.map((acc) => {
            const style = COLOR_STYLES[acc.color] || COLOR_STYLES.blue
            const isGoal = acc.type === 'goal' && acc.targetAmount > 0
            const progressPct = isGoal
              ? Math.min(100, (acc.currentAmount / acc.targetAmount) * 100)
              : 100
            const remaining = isGoal ? Math.max(0, acc.targetAmount - acc.currentAmount) : 0
            const isActionOpen = activeAction?.id === acc.id

            return (
              <div
                key={acc.id}
                className={`rounded-2xl border p-5 transition-all bg-white ${style.border} shadow-sm flex flex-col justify-between`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl ${style.bg} border ${style.border} flex items-center justify-center text-2xl`}
                      >
                        {acc.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-900 text-lg leading-tight">
                            {acc.name}
                          </h3>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${style.badge}`}
                          >
                            {isGoal ? 'Savings Goal' : 'Sub-Account'}
                          </span>
                          {acc.autoSplitPercent > 0 && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                              ⚡ {acc.autoSplitPercent}% Auto-Split
                            </span>
                          )}
                        </div>
                        {acc.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{acc.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(acc)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100"
                        title="Edit Sub-Account"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDeleteSubAccount(acc)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                        title="Delete Sub-Account"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Balance & Progress */}
                  <div className="my-4">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <div>
                        <span className="text-2xl font-extrabold text-gray-900">
                          ${acc.currentAmount.toFixed(2)}
                        </span>
                        {isGoal && (
                          <span className="text-sm text-gray-500 ml-1.5">
                            of ${acc.targetAmount.toFixed(2)} goal
                          </span>
                        )}
                      </div>
                      {isGoal && (
                        <span className={`text-sm font-bold ${style.text}`}>
                          {progressPct.toFixed(0)}%
                        </span>
                      )}
                    </div>

                    {isGoal && (
                      <>
                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`${style.bar} h-2.5 rounded-full transition-all duration-300`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-1.5 text-xs text-gray-500">
                          <span>
                            {remaining > 0
                              ? `$${remaining.toFixed(2)} left to reach goal`
                              : '🎉 Goal target reached! Ready to purchase!'}
                          </span>
                          {acc.targetDate && (
                            <span>Target: {acc.targetDate.toLocaleDateString()}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Action Controls */}
                {isActionOpen ? (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2.5 bg-gray-50/80 p-3 rounded-xl">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                      <span>
                        {activeAction.mode === 'deposit' &&
                          `Move from Checking ($${Math.max(0, spendableBalance).toFixed(2)} avail)`}
                        {activeAction.mode === 'withdraw' &&
                          `Move back to Checking ($${acc.currentAmount.toFixed(2)} avail)`}
                        {activeAction.mode === 'spend' &&
                          `Spend & Record Ledger Debit from ${acc.name}`}
                      </span>
                      <button
                        onClick={() => {
                          setActiveAction(null)
                          setActionAmount('')
                          setActionNote('')
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Quick Chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {[1, 5, 10, 20].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setActionAmount(val.toString())}
                          className="text-xs px-2 py-1 rounded bg-white border border-gray-200 hover:border-blue-400 font-medium text-gray-700"
                        >
                          ${val}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          if (activeAction.mode === 'deposit') {
                            const max = isGoal
                              ? Math.min(Math.max(0, spendableBalance), Math.max(0, remaining))
                              : Math.max(0, spendableBalance)
                            setActionAmount(max.toFixed(2))
                          } else {
                            setActionAmount(acc.currentAmount.toFixed(2))
                          }
                        }}
                        className="text-xs px-2 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 font-semibold"
                      >
                        Max
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={actionAmount}
                        onChange={(e) => setActionAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-28 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm"
                      />
                      {activeAction.mode === 'spend' && (
                        <input
                          type="text"
                          value={actionNote}
                          onChange={(e) => setActionNote(e.target.value)}
                          placeholder={`Item bought (e.g. ${acc.name})`}
                          className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm"
                        />
                      )}
                      <button
                        type="button"
                        disabled={isSubmitting || !actionAmount || parseFloat(actionAmount) <= 0}
                        onClick={() => handleCardAction(acc)}
                        className={`px-3.5 py-1.5 rounded-lg text-white text-xs font-bold transition-colors disabled:opacity-50 ${
                          activeAction.mode === 'spend'
                            ? 'bg-rose-600 hover:bg-rose-700'
                            : activeAction.mode === 'withdraw'
                            ? 'bg-amber-600 hover:bg-amber-700'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        {activeAction.mode === 'deposit' && 'Transfer In'}
                        {activeAction.mode === 'withdraw' && 'Withdraw'}
                        {activeAction.mode === 'spend' && 'Record Purchase'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setActiveAction({ id: acc.id, mode: 'deposit' })
                        setActionAmount('')
                      }}
                      className="py-2 px-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs transition-colors"
                    >
                      ＋ Add Funds
                    </button>
                    <button
                      disabled={acc.currentAmount <= 0}
                      onClick={() => {
                        setActiveAction({ id: acc.id, mode: 'withdraw' })
                        setActionAmount('')
                      }}
                      className="py-2 px-2 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 font-semibold text-xs transition-colors"
                    >
                      ⇄ Withdraw
                    </button>
                    <button
                      disabled={acc.currentAmount <= 0}
                      onClick={() => {
                        setActiveAction({ id: acc.id, mode: 'spend' })
                        setActionAmount(acc.currentAmount.toFixed(2))
                        setActionNote(`Bought ${acc.name}`)
                      }}
                      className="py-2 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-700 font-semibold text-xs transition-colors"
                    >
                      🛍️ Spend
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Completed Goals Archive */}
      {completedAccounts.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-gray-200">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">
            🏆 Completed Savings Goals ({completedAccounts.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {completedAccounts.map((acc) => (
              <div
                key={acc.id}
                className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{acc.icon}</span>
                  <div>
                    <p className="font-bold text-sm text-emerald-950">{acc.name}</p>
                    <p className="text-xs text-emerald-700">
                      Target: ${acc.targetAmount.toFixed(2)} · Completed!
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteSubAccount(acc)}
                  className="text-xs text-gray-400 hover:text-red-600 px-2 py-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto-Split Modal */}
      {showSplitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">⚡ Auto-Split into Sub-Accounts</h3>
              <button
                onClick={() => setShowSplitModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Automatically allocate a deposit or allowance amount from Available Checking ($
              {Math.max(0, spendableBalance).toFixed(2)}) into {kidName}&apos;s sub-accounts using
              their configured percentages:
            </p>
            <form onSubmit={handleAutoSplitDistribute} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                  Amount to Split ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Math.max(0, spendableBalance)}
                  value={splitBaseAmount}
                  onChange={(e) => setSplitBaseAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-lg font-bold"
                  required
                />
              </div>
              <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-sm">
                {activeAccounts
                  .filter((a) => a.autoSplitPercent > 0)
                  .map((a) => {
                    const amt = ((parseFloat(splitBaseAmount) || 0) * a.autoSplitPercent) / 100
                    return (
                      <div key={a.id} className="flex justify-between items-center">
                        <span>
                          {a.icon} {a.name} ({a.autoSplitPercent}%)
                        </span>
                        <span className="font-bold text-indigo-700">+${amt.toFixed(2)}</span>
                      </div>
                    )
                  })}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSplitModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm"
                >
                  {isSubmitting ? 'Splitting...' : 'Distribute Funds'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Sub-Account Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {editingAccount ? 'Edit Sub-Account / Goal' : 'New Sub-Account or Savings Goal'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            {!editingAccount && (
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Quick Templates
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_TEMPLATES.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          name: t.name,
                          type: t.type,
                          icon: t.icon,
                          color: t.color,
                          targetAmount: t.targetAmount > 0 ? t.targetAmount.toString() : '',
                          autoSplitPercent: t.autoSplitPercent.toString(),
                          description: t.description,
                        })
                      }
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 flex items-center gap-1"
                    >
                      <span>{t.icon}</span>
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveSubAccount} className="space-y-4">
              {/* Type Selector */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'goal' })}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    formData.type === 'goal'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🎯 Target Savings Goal
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'bucket' })}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    formData.type === 'bucket'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🐷 Ongoing Sub-Account Jar
                </button>
              </div>

              {/* Icon & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Icon</label>
                  <select
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-lg"
                  >
                    {EMOJI_CHOICES.map((em) => (
                      <option key={em} value={em}>
                        {em}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Sub-Account / Goal Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={
                      formData.type === 'goal'
                        ? 'e.g., Nintendo Switch, New Bike'
                        : 'e.g., Long-Term Savings, Giving Jar'
                    }
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Color Theme
                </label>
                <div className="flex gap-2">
                  {(['blue', 'purple', 'emerald', 'amber', 'rose', 'indigo'] as SubAccountColor[]).map(
                    (c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: c })}
                        className={`w-8 h-8 rounded-full ${COLOR_STYLES[c].bar} ${
                          formData.color === c ? 'ring-2 ring-offset-2 ring-gray-900' : 'opacity-70'
                        }`}
                      />
                    )
                  )}
                </div>
              </div>

              {/* Target Amount (if goal) & Auto-Split % */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {formData.type === 'goal' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Target Goal Amount ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.targetAmount}
                      onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                      placeholder="100.00"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Auto-Split Allowance (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={formData.autoSplitPercent}
                    onChange={(e) =>
                      setFormData({ ...formData, autoSplitPercent: e.target.value })
                    }
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                  />
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Optional % of new allowances routed to this sub-account
                  </p>
                </div>
              </div>

              {/* Initial Deposit (only on create) & Target Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {!editingAccount && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Initial Transfer from Checking ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={Math.max(0, spendableBalance)}
                      value={formData.initialAmount}
                      onChange={(e) => setFormData({ ...formData, initialAmount: e.target.value })}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                    />
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Available Checking: ${Math.max(0, spendableBalance).toFixed(2)}
                    </p>
                  </div>
                )}

                {formData.type === 'goal' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Target Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={formData.targetDate}
                      onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Description / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Why are we saving in this sub-account?"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : editingAccount
                    ? 'Save Changes'
                    : 'Create Sub-Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
