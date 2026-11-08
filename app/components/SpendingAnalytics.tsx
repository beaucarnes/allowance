'use client'

import { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'

interface SpendingAnalyticsProps {
  kidId: string
  kidName: string
}

interface RawTx {
  id: string
  amount: number
  description: string
  date: Date
  parentName?: string
}

export default function SpendingAnalytics({ kidId, kidName }: SpendingAnalyticsProps) {
  const [txs, setTxs] = useState<RawTx[]>([])

  useEffect(() => {
    const q = query(
      collection(db, 'kids', kidId, 'transactions'),
      orderBy('date', 'desc'),
      limit(100)
    )
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          amount: Number(data.amount || 0),
          description: data.description || '',
          date: data.date?.toDate ? data.date.toDate() : new Date(),
          parentName: data.parentName || '',
        }
      })
      setTxs(list)
    })
    return () => unsub()
  }, [kidId])

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const recentTxs = txs.filter((t) => t.date >= thirtyDaysAgo)

  const recentEarned = recentTxs
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)
  const recentSpent = recentTxs
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const savingsRate =
    recentEarned > 0
      ? Math.max(0, Math.min(100, Math.round(((recentEarned - recentSpent) / recentEarned) * 100)))
      : 0

  const handleExportCsv = () => {
    if (txs.length === 0) return
    const header = ['Date', 'Type', 'Amount', 'Description', 'Recorded By']
    const rows = txs.map((t) => [
      t.date.toISOString().split('T')[0],
      t.amount >= 0 ? 'Credit' : 'Debit',
      t.amount.toFixed(2),
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${(t.parentName || '').replace(/"/g, '""')}"`,
    ])
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${kidName.toLowerCase().replace(/[^a-z0-9]/g, '')}-allowance-ledger.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">📊 30-Day Financial Snapshot</h3>
          <p className="text-sm text-gray-600">
            Recent credits, debits, and savings rate for {kidName}
          </p>
        </div>
        {txs.length > 0 && (
          <button
            onClick={handleExportCsv}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-xl text-xs transition-colors self-start sm:self-auto"
          >
            ⬇ Export Ledger CSV ({txs.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
          <p className="text-xs font-semibold uppercase text-emerald-700">Earned (Last 30d)</p>
          <p className="text-2xl font-extrabold text-emerald-900 mt-1">
            +${recentEarned.toFixed(2)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200">
          <p className="text-xs font-semibold uppercase text-rose-700">Spent (Last 30d)</p>
          <p className="text-2xl font-extrabold text-rose-900 mt-1">
            -${recentSpent.toFixed(2)}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200">
          <p className="text-xs font-semibold uppercase text-blue-700">30-Day Savings Rate</p>
          <p className="text-2xl font-extrabold text-blue-900 mt-1">{savingsRate}%</p>
        </div>
      </div>
    </div>
  )
}
