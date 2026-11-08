'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/app/lib/firebase'
import KidSettings from '@/app/components/KidSettings'
import ShareAccess from '@/app/components/ShareAccess'
import DashboardVisibility from '@/app/components/DashboardVisibility'
import AccountDetails from '@/app/components/AccountDetails'
import DeleteKid from '@/app/components/DeleteKid'

type KidData = {
  id: string
  name: string
  total: number
  parentId: string
  sharedWith: string[]
  public?: boolean
  slug: string
  weeklyAllowance?: number
  allowanceDay?: string
  interestRateMonthly?: number
  allowKidSubaccountTransfers?: boolean
  allowKidChoreCheckoff?: boolean
}

export default function SettingsPage({ kid }: { kid: KidData }) {
  const [interestRate, setInterestRate] = useState(
    (kid.interestRateMonthly || 0).toString()
  )
  const [allowTransfers, setAllowTransfers] = useState(
    kid.allowKidSubaccountTransfers !== false
  )
  const [allowChores, setAllowChores] = useState(
    kid.allowKidChoreCheckoff !== false
  )
  const [savingBankRules, setSavingBankRules] = useState(false)

  const handleSaveBankRules = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingBankRules(true)
    try {
      await updateDoc(doc(db, 'kids', kid.id), {
        interestRateMonthly: Math.max(0, Math.min(50, parseFloat(interestRate) || 0)),
        allowKidSubaccountTransfers: allowTransfers,
        allowKidChoreCheckoff: allowChores,
      })
      alert('Saved Bank & Kid Dashboard rules!')
    } catch (err) {
      console.error('Error saving bank rules:', err)
      alert('Failed to save settings.')
    } finally {
      setSavingBankRules(false)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Settings for {kid.name}</h1>
        <Link
          href={`/parent/kid/${kid.slug}`}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          ← Back to {kid.name}&apos;s Dashboard
        </Link>
      </div>

      <div className="space-y-8">
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold mb-4">Weekly Allowance</h2>
          <KidSettings
            kidId={kid.id}
            initialAllowance={kid.weeklyAllowance || 0}
            initialAllowanceDay={kid.allowanceDay || 'Sunday'}
            isOwner={true}
          />
        </section>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold mb-2">
            🏦 Bank of Mom &amp; Dad Rules (Interest &amp; Sub-Accounts)
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Configure parent-paid monthly compound interest and what {kid.name} can do on their
            personal dashboard (/{kid.slug}).
          </p>
          <form onSubmit={handleSaveBankRules} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Parent Interest Rate (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="border rounded-lg p-2 w-32"
                />
                <span className="text-sm text-gray-600">% per month</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowTransfers}
                  onChange={(e) => setAllowTransfers(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-800">
                  Allow {kid.name} to create savings goals and move money between their Checking &amp;
                  Sub-Accounts on /{kid.slug} (does not change total balance)
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowChores}
                  onChange={(e) => setAllowChores(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-800">
                  Allow {kid.name} to mark Chores &amp; Bounties as &ldquo;Done (Pending Parent
                  Approval)&rdquo; on /{kid.slug}
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={savingBankRules}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm"
            >
              {savingBankRules ? 'Saving...' : 'Save Bank Rules'}
            </button>
          </form>
        </section>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold mb-4">Kid Dashboard Visibility</h2>
          <DashboardVisibility kidId={kid.id} isPublic={kid.public || false} />
        </section>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <ShareAccess kidId={kid.id} sharedWith={kid.sharedWith || []} />
        </section>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold mb-4">Account Details</h2>
          <AccountDetails
            kidId={kid.id}
            initialName={kid.name}
            initialSlug={kid.slug}
          />
        </section>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <DeleteKid kidId={kid.id} kidName={kid.name} />
        </section>
      </div>
    </div>
  )
}
