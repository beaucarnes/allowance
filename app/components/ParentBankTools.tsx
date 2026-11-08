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
  getDocs,
  serverTimestamp,
  increment,
  query,
  orderBy,
} from 'firebase/firestore'
import { Chore } from '../lib/types'

interface ParentBankToolsProps {
  kidId: string
  kidName: string
  weeklyAllowance?: number
  allowanceDay?: string
}

const CHORE_PRESETS = [
  { title: 'Clean Bedroom & Make Bed', reward: 3, icon: '🧹', frequency: 'weekly' as const },
  { title: 'Unload Dishwasher', reward: 2, icon: '🍽️', frequency: 'daily' as const },
  { title: 'Wash the Family Car', reward: 10, icon: '🚗', frequency: 'one_time' as const },
  { title: 'Read a Chapter Book', reward: 5, icon: '📚', frequency: 'one_time' as const },
  { title: 'Take Out Trash & Recycling', reward: 2, icon: '🗑️', frequency: 'weekly' as const },
  { title: 'Yard Work / Pull Weeds', reward: 8, icon: '🌱', frequency: 'one_time' as const },
]

export default function ParentBankTools({
  kidId,
  kidName,
  weeklyAllowance = 0,
  allowanceDay = 'Sunday',
}: ParentBankToolsProps) {
  const [totalBalance, setTotalBalance] = useState(0)
  const [interestRateMonthly, setInterestRateMonthly] = useState(0)
  const [editingInterest, setEditingInterest] = useState(false)
  const [interestInput, setInterestInput] = useState('2')
  const [chores, setChores] = useState<Chore[]>([])
  const [showAddChore, setShowAddChore] = useState(false)
  const [choreForm, setChoreForm] = useState({
    title: '',
    reward: '',
    icon: '🧹',
    frequency: 'one_time' as 'one_time' | 'daily' | 'weekly',
  })
  const [isBusy, setIsBusy] = useState(false)
  const [statusBanner, setStatusBanner] = useState<string | null>(null)

  useEffect(() => {
    const unsubKid = onSnapshot(doc(db, 'kids', kidId), (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setTotalBalance(Number(data?.total || 0))
        const rate = Number(data?.interestRateMonthly || 0)
        setInterestRateMonthly(rate)
        setInterestInput(rate > 0 ? rate.toString() : '2')
      }
    })

    const q = query(collection(db, 'kids', kidId, 'chores'), orderBy('createdDate', 'desc'))
    const unsubChores = onSnapshot(
      q,
      (snap) => {
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
            lastApprovedAt: data.lastApprovedAt?.toDate ? data.lastApprovedAt.toDate() : null,
            createdDate: data.createdDate?.toDate ? data.createdDate.toDate() : new Date(),
          } as Chore
        })
        setChores(list)
      },
      (err) => {
        console.error('Error loading chores:', err)
      }
    )

    return () => {
      unsubKid()
      unsubChores()
    }
  }, [kidId])

  const showToast = (msg: string) => {
    setStatusBanner(msg)
    setTimeout(() => setStatusBanner(null), 4500)
  }

  const handlePayWeeklyAllowance = async () => {
    if (weeklyAllowance <= 0) return
    setIsBusy(true)
    try {
      // Check if kid has any auto-split sub-accounts
      const goalsSnap = await getDocs(collection(db, 'kids', kidId, 'goals'))
      const splitDescriptions: string[] = []

      for (const goalDoc of goalsSnap.docs) {
        const g = goalDoc.data()
        if (!g.completed && g.autoSplitPercent && g.autoSplitPercent > 0) {
          const share = Number(((weeklyAllowance * Number(g.autoSplitPercent)) / 100).toFixed(2))
          if (share > 0) {
            const current = Number(g.currentAmount ?? g.savedAmount ?? 0)
            await updateDoc(doc(db, 'kids', kidId, 'goals', goalDoc.id), {
              currentAmount: Number((current + share).toFixed(2)),
            })
            splitDescriptions.push(`$${share.toFixed(2)} → ${g.name}`)
          }
        }
      }

      const desc =
        splitDescriptions.length > 0
          ? `Weekly Allowance (Auto-split: ${splitDescriptions.join(', ')})`
          : 'Weekly Allowance'

      await addDoc(collection(db, 'kids', kidId, 'transactions'), {
        amount: weeklyAllowance,
        description: desc,
        date: serverTimestamp(),
        parentName: auth.currentUser?.displayName || 'Parent',
        parentEmail: auth.currentUser?.email || '',
        category: 'allowance',
      })

      await updateDoc(doc(db, 'kids', kidId), {
        total: increment(weeklyAllowance),
        lastAllowancePaidAt: serverTimestamp(),
      })

      showToast(
        `Paid $${weeklyAllowance.toFixed(2)} weekly allowance to ${kidName}${
          splitDescriptions.length > 0 ? ` (${splitDescriptions.join(', ')})` : ''
        }!`
      )
    } catch (err) {
      console.error('Error paying weekly allowance:', err)
      alert('Failed to pay weekly allowance.')
    } finally {
      setIsBusy(false)
    }
  }

  const handleSaveInterestRate = async (e: React.FormEvent) => {
    e.preventDefault()
    const rate = Math.max(0, Math.min(50, parseFloat(interestInput) || 0))
    setIsBusy(true)
    try {
      await updateDoc(doc(db, 'kids', kidId), {
        interestRateMonthly: rate,
      })
      setEditingInterest(false)
      showToast(`Updated ${kidName}'s monthly parent interest rate to ${rate}%!`)
    } catch (err) {
      console.error('Error updating interest rate:', err)
      alert('Failed to update interest rate.')
    } finally {
      setIsBusy(false)
    }
  }

  const monthlyInterestPayout =
    totalBalance > 0 && interestRateMonthly > 0
      ? Number(((totalBalance * interestRateMonthly) / 100).toFixed(2))
      : 0

  const handlePayInterestNow = async () => {
    if (monthlyInterestPayout <= 0) return
    setIsBusy(true)
    try {
      await addDoc(collection(db, 'kids', kidId, 'transactions'), {
        amount: monthlyInterestPayout,
        description: `[Interest] Bank of Mom & Dad (${interestRateMonthly}% monthly interest)`,
        date: serverTimestamp(),
        parentName: auth.currentUser?.displayName || 'Parent Bank',
        parentEmail: auth.currentUser?.email || '',
        category: 'interest',
      })

      await updateDoc(doc(db, 'kids', kidId), {
        total: increment(monthlyInterestPayout),
        lastInterestPaidAt: serverTimestamp(),
      })

      showToast(
        `Paid $${monthlyInterestPayout.toFixed(2)} (${interestRateMonthly}% interest) to ${kidName}!`
      )
    } catch (err) {
      console.error('Error paying interest:', err)
      alert('Failed to pay interest.')
    } finally {
      setIsBusy(false)
    }
  }

  const handleAddChore = async (e: React.FormEvent) => {
    e.preventDefault()
    const reward = parseFloat(choreForm.reward)
    if (!choreForm.title.trim() || !reward || reward <= 0) return

    setIsBusy(true)
    try {
      await addDoc(collection(db, 'kids', kidId, 'chores'), {
        title: choreForm.title.trim(),
        reward: Number(reward.toFixed(2)),
        icon: choreForm.icon || '🧹',
        frequency: choreForm.frequency,
        status: 'open',
        createdDate: serverTimestamp(),
      })
      setChoreForm({ title: '', reward: '', icon: '🧹', frequency: 'one_time' })
      setShowAddChore(false)
      showToast(`Added "${choreForm.title.trim()}" ($${reward.toFixed(2)}) to ${kidName}'s board!`)
    } catch (err) {
      console.error('Error adding chore:', err)
      alert('Failed to create chore.')
    } finally {
      setIsBusy(false)
    }
  }

  const handleApproveAndPayChore = async (chore: Chore) => {
    setIsBusy(true)
    try {
      await addDoc(collection(db, 'kids', kidId, 'transactions'), {
        amount: chore.reward,
        description: `[Chore] ${chore.icon} ${chore.title}`,
        date: serverTimestamp(),
        parentName: auth.currentUser?.displayName || 'Parent',
        parentEmail: auth.currentUser?.email || '',
        category: 'chore',
      })

      await updateDoc(doc(db, 'kids', kidId), {
        total: increment(chore.reward),
      })

      const choreRef = doc(db, 'kids', kidId, 'chores', chore.id)
      if (chore.frequency === 'one_time') {
        await updateDoc(choreRef, {
          status: 'completed',
          lastApprovedAt: serverTimestamp(),
        })
      } else {
        // Recurring chores reset to 'open' so the kid can do them again next day/week!
        await updateDoc(choreRef, {
          status: 'open',
          completedByKidAt: null,
          lastApprovedAt: serverTimestamp(),
        })
      }

      showToast(`Approved "${chore.title}" and paid $${chore.reward.toFixed(2)} to ${kidName}!`)
    } catch (err) {
      console.error('Error paying chore:', err)
      alert('Failed to pay chore.')
    } finally {
      setIsBusy(false)
    }
  }

  const handleDeleteChore = async (choreId: string) => {
    try {
      await deleteDoc(doc(db, 'kids', kidId, 'chores', choreId))
    } catch (err) {
      console.error('Error deleting chore:', err)
    }
  }

  const pendingChores = chores.filter((c) => c.status === 'pending_approval')
  const openChores = chores.filter((c) => c.status === 'open')

  return (
    <div className="space-y-6">
      {statusBanner && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-md flex items-center justify-between text-sm font-medium">
          <span>✅ {statusBanner}</span>
          <button onClick={() => setStatusBanner(null)} className="text-white/80 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Row of 2 Cards: Weekly Allowance Quick-Pay + Parent-Paid Compound Interest */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weekly Allowance Quick-Pay */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                📅 Automatic &amp; 1-Click Allowance
              </span>
              <span className="text-xl">💵</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">Weekly Allowance</h3>
            {weeklyAllowance > 0 ? (
              <p className="text-sm text-gray-600 mb-4">
                Scheduled: <strong className="text-gray-900">${weeklyAllowance.toFixed(2)}</strong>{' '}
                every <strong className="text-gray-900">{allowanceDay}</strong>. Paying here also
                applies any Sub-Account Auto-Split % rules!
              </p>
            ) : (
              <p className="text-sm text-gray-600 mb-4">
                No weekly allowance amount set yet. You can configure a weekly amount in Settings.
              </p>
            )}
          </div>

          {weeklyAllowance > 0 && (
            <button
              onClick={handlePayWeeklyAllowance}
              disabled={isBusy}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <span>⚡</span>
              <span>Pay Weekly Allowance (+${weeklyAllowance.toFixed(2)})</span>
            </button>
          )}
        </div>

        {/* Parent-Paid Interest Engine */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                📈 Bank of Mom &amp; Dad APY
              </span>
              <button
                onClick={() => setEditingInterest(!editingInterest)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                {editingInterest ? 'Cancel' : interestRateMonthly > 0 ? 'Change Rate' : 'Set Rate'}
              </button>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">Parent-Paid Interest</h3>

            {editingInterest ? (
              <form onSubmit={handleSaveInterestRate} className="my-3 space-y-2">
                <label className="block text-xs font-semibold text-gray-700">
                  Monthly Interest Rate (%)
                </label>
                <div className="flex gap-2">
                  {[0, 1, 2, 3, 5].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setInterestInput(pct.toString())}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        interestInput === pct.toString()
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    value={interestInput}
                    onChange={(e) => setInterestInput(e.target.value)}
                    className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                  >
                    Save
                  </button>
                </div>
              </form>
            ) : interestRateMonthly > 0 ? (
              <p className="text-sm text-gray-600 mb-4">
                Earning <strong className="text-emerald-700">{interestRateMonthly}% / month</strong>{' '}
                on ${totalBalance.toFixed(2)} balance ={' '}
                <strong className="text-emerald-800">+${monthlyInterestPayout.toFixed(2)}/mo</strong>
                . Teaches compound growth!
              </p>
            ) : (
              <p className="text-sm text-gray-600 mb-4">
                Reward {kidName} for saving instead of spending! Set a monthly parent interest rate
                (e.g. 2%/month).
              </p>
            )}
          </div>

          {interestRateMonthly > 0 ? (
            <button
              onClick={handlePayInterestNow}
              disabled={isBusy || monthlyInterestPayout <= 0}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm transition-colors shadow-sm"
            >
              📈 Pay Monthly Interest (+${monthlyInterestPayout.toFixed(2)})
            </button>
          ) : (
            !editingInterest && (
              <button
                onClick={() => setEditingInterest(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-sm transition-colors border border-emerald-200"
              >
                Enable Parent-Paid Interest (e.g. 2%/mo)
              </button>
            )
          )}
        </div>
      </div>

      {/* Chores & Bounties Board */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full mb-1">
              <span>⭐</span>
              <span>Earn Extra Money</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900">
              Chores &amp; Bounties Board for {kidName}
            </h3>
            <p className="text-sm text-gray-600">
              Post jobs {kidName} can complete to earn extra money into their bank account
            </p>
          </div>
          <button
            onClick={() => setShowAddChore(!showAddChore)}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-xl text-sm transition-colors self-start sm:self-auto shadow-sm"
          >
            {showAddChore ? 'Close Form' : '＋ Post Chore / Bounty'}
          </button>
        </div>

        {/* Add Chore Form */}
        {showAddChore && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {CHORE_PRESETS.map((p) => (
                <button
                  key={p.title}
                  type="button"
                  onClick={() =>
                    setChoreForm({
                      title: p.title,
                      reward: p.reward.toString(),
                      icon: p.icon,
                      frequency: p.frequency,
                    })
                  }
                  className="text-xs px-2.5 py-1 rounded-lg bg-white border border-amber-200 hover:border-amber-400 text-gray-800 font-medium"
                >
                  {p.icon} {p.title} (${p.reward})
                </button>
              ))}
            </div>
            <form onSubmit={handleAddChore} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <input
                type="text"
                value={choreForm.title}
                onChange={(e) => setChoreForm({ ...choreForm, title: e.target.value })}
                placeholder="Chore or bounty description..."
                className="sm:col-span-2 border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
                required
              />
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={choreForm.reward}
                onChange={(e) => setChoreForm({ ...choreForm, reward: e.target.value })}
                placeholder="Reward ($)"
                className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
                required
              />
              <select
                value={choreForm.frequency}
                onChange={(e) =>
                  setChoreForm({
                    ...choreForm,
                    frequency: e.target.value as 'one_time' | 'daily' | 'weekly',
                  })
                }
                className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="one_time">One-Time Bounty</option>
                <option value="daily">Daily Chore</option>
                <option value="weekly">Weekly Chore</option>
              </select>
              <button
                type="submit"
                disabled={isBusy}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl px-4 py-2 text-sm"
              >
                Add Job
              </button>
            </form>
          </div>
        )}

        {/* Pending Approval Chores */}
        {pendingChores.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              🔔 Waiting for Your Approval ({pendingChores.length})
            </p>
            {pendingChores.map((c) => (
              <div
                key={c.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-300"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{c.icon}</span>
                  <div>
                    <p className="font-bold text-gray-900">{c.title}</p>
                    <p className="text-xs text-emerald-800 font-medium">
                      Marked done by {kidName}! Reward: <strong>${c.reward.toFixed(2)}</strong>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApproveAndPayChore(c)}
                    disabled={isBusy}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm"
                  >
                    ✓ Approve &amp; Pay +${c.reward.toFixed(2)}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Open Chores */}
        {openChores.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {openChores.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 bg-gray-50/60"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{c.icon}</span>
                  <div>
                    <p className="font-bold text-sm text-gray-900">{c.title}</p>
                    <p className="text-xs text-gray-500">
                      Reward: <strong className="text-emerald-700">+${c.reward.toFixed(2)}</strong>{' '}
                      ·{' '}
                      {c.frequency === 'one_time'
                        ? 'One-Time Bounty'
                        : c.frequency === 'daily'
                        ? 'Repeats Daily'
                        : 'Repeats Weekly'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleApproveAndPayChore(c)}
                    disabled={isBusy}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold px-3 py-1.5 rounded-lg text-xs"
                    title="Pay reward directly"
                  >
                    Pay +${c.reward.toFixed(2)}
                  </button>
                  <button
                    onClick={() => handleDeleteChore(c.id)}
                    className="text-gray-400 hover:text-red-600 p-1.5 text-xs"
                    title="Remove chore"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          pendingChores.length === 0 && (
            <p className="text-sm text-gray-500 italic">
              No active chores or bounties posted yet. Click &ldquo;Post Chore / Bounty&rdquo; to
              give {kidName} ways to earn extra money!
            </p>
          )
        )}
      </div>
    </div>
  )
}
