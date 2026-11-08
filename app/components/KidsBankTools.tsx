'use client'

import { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import { Chore } from '../lib/types'

interface KidsBankToolsProps {
  kidId: string
  kidName: string
  canEdit?: boolean
}

export default function KidsBankTools({ kidId, kidName, canEdit = false }: KidsBankToolsProps) {
  const [totalBalance, setTotalBalance] = useState(0)
  const [weeklyAllowance, setWeeklyAllowance] = useState(5)
  const [interestRateMonthly, setInterestRateMonthly] = useState(2)
  const [chores, setChores] = useState<Chore[]>([])
  const [weeklySaveSlider, setWeeklySaveSlider] = useState(5)
  const [isBusy, setIsBusy] = useState<string | null>(null)

  useEffect(() => {
    const unsubKid = onSnapshot(doc(db, 'kids', kidId), (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setTotalBalance(Number(data?.total || 0))
        if (data?.weeklyAllowance && data.weeklyAllowance > 0) {
          setWeeklyAllowance(Number(data.weeklyAllowance))
          setWeeklySaveSlider(Math.max(1, Math.round(Number(data.weeklyAllowance) / 2)))
        }
        if (data?.interestRateMonthly !== undefined && data.interestRateMonthly > 0) {
          setInterestRateMonthly(Number(data.interestRateMonthly))
        }
      }
    })

    const q = query(collection(db, 'kids', kidId, 'chores'), orderBy('createdDate', 'desc'))
    const unsubChores = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          title: data.title || 'Chore',
          reward: Number(data.reward || 0),
          frequency: data.frequency || 'one_time',
          icon: data.icon || '🧹',
          status: data.status || 'open',
          completedByKidAt: data.completedByKidAt?.toDate ? data.completedByKidAt.toDate() : null,
          createdDate: data.createdDate?.toDate ? data.createdDate.toDate() : new Date(),
        } as Chore
      })
      setChores(list)
    })

    return () => {
      unsubKid()
      unsubChores()
    }
  }, [kidId])

  const handleMarkDone = async (chore: Chore) => {
    setIsBusy(chore.id)
    try {
      await updateDoc(doc(db, 'kids', kidId, 'chores', chore.id), {
        status: 'pending_approval',
        completedByKidAt: serverTimestamp(),
      })
    } catch (err) {
      console.error('Error marking chore done:', err)
      alert('Ask a parent to mark this chore done!')
    } finally {
      setIsBusy(null)
    }
  }

  // Compound growth projection helper
  const projectBalance = (months: number) => {
    const monthlyRate = interestRateMonthly / 100
    const monthlyContribution = weeklySaveSlider * 4.33
    let bal = Math.max(0, totalBalance)
    for (let m = 0; m < months; m++) {
      bal = bal * (1 + monthlyRate) + monthlyContribution
    }
    return bal
  }

  const activeChores = chores.filter((c) => c.status === 'open' || c.status === 'pending_approval')

  return (
    <div className="space-y-6">
      {/* Chores & Bounties Section (if any exist) */}
      {activeChores.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full mb-1">
              ⭐ Earn Extra Money
            </span>
            <h2 className="text-2xl font-bold text-gray-900">
              Available Chores &amp; Bounties
            </h2>
            <p className="text-sm text-gray-600">
              Complete jobs below and tap &ldquo;I Did It!&rdquo; to earn money into your account!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeChores.map((c) => (
              <div
                key={c.id}
                className={`p-4 rounded-2xl border-2 flex items-center justify-between gap-3 ${
                  c.status === 'pending_approval'
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-amber-50/40 border-amber-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{c.icon}</span>
                  <div>
                    <p className="font-bold text-gray-900">{c.title}</p>
                    <p className="text-xs font-semibold text-emerald-700">
                      Reward: +${c.reward.toFixed(2)}{' '}
                      <span className="text-gray-500 font-normal">
                        ({c.frequency === 'one_time' ? 'Bounty' : c.frequency})
                      </span>
                    </p>
                  </div>
                </div>

                {c.status === 'pending_approval' ? (
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold whitespace-nowrap">
                    ⏳ Waiting for Parent
                  </span>
                ) : canEdit ? (
                  <button
                    disabled={isBusy === c.id}
                    onClick={() => handleMarkDone(c)}
                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs whitespace-nowrap shadow-sm transition-colors"
                  >
                    🎉 I Did It!
                  </button>
                ) : (
                  <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 text-xs font-bold whitespace-nowrap">
                    Open Chore
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Future Wealth / Compound Interest Calculator for Kids */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-blue-950 text-white p-6 rounded-2xl shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300 bg-white/10 px-2.5 py-1 rounded-full mb-2">
              🚀 Future Wealth Time Machine
            </span>
            <h2 className="text-2xl font-bold">
              See How Fast {kidName}&apos;s Money Can Grow!
            </h2>
            <p className="text-sm text-indigo-200 mt-0.5">
              Drag the slider to see what happens when you save every week + earn{' '}
              {interestRateMonthly}% monthly parent interest!
            </p>
          </div>
          {weeklyAllowance > 0 && (
            <div className="bg-white/10 px-4 py-2.5 rounded-xl text-right self-start">
              <div className="text-xs text-indigo-200">Weekly Allowance</div>
              <div className="text-lg font-extrabold text-emerald-300">
                ${weeklyAllowance.toFixed(2)}/wk
              </div>
            </div>
          )}
        </div>

        <div className="bg-white/10 p-4 rounded-xl mb-5">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-semibold text-indigo-100">
              If I save this much every week:
            </label>
            <span className="text-xl font-extrabold text-emerald-300">
              ${weeklySaveSlider}/week
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="50"
            step="1"
            value={weeklySaveSlider}
            onChange={(e) => setWeeklySaveSlider(parseInt(e.target.value))}
            className="w-full accent-emerald-400 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-indigo-300 mt-1">
            <span>$1/wk</span>
            <span>$10/wk</span>
            <span>$25/wk</span>
            <span>$50/wk</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'In 6 Months', months: 6 },
            { label: 'In 1 Year', months: 12 },
            { label: 'In 2 Years', months: 24 },
            { label: 'In 3 Years', months: 36 },
          ].map((item) => {
            const projected = projectBalance(item.months)
            return (
              <div
                key={item.label}
                className="bg-white/10 border border-white/10 rounded-xl p-3.5 text-center"
              >
                <div className="text-xs text-indigo-200 font-medium mb-1">{item.label}</div>
                <div className="text-2xl font-extrabold text-emerald-300">
                  ${projected.toFixed(0)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
