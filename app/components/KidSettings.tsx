'use client'

import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

interface KidSettingsProps {
  kidId: string;
  initialAllowance: number;
  initialAllowanceDay: string;
  isOwner: boolean;
}

export default function KidSettings({ 
  kidId, 
  initialAllowance, 
  initialAllowanceDay,
  isOwner 
}: KidSettingsProps) {
  const [amount, setAmount] = useState(initialAllowance.toString())
  const [day, setDay] = useState(initialAllowanceDay)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isOwner) return

    setIsSubmitting(true)
    try {
      await updateDoc(doc(db, 'kids', kidId), {
        weeklyAllowance: parseFloat(amount),
        allowanceDay: day
      })
    } catch (error) {
      console.error('Error updating allowance:', error)
      alert('Failed to update allowance. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const daysOfWeek = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Weekly Amount
        </label>
        <div className="flex items-center">
          <span className="mr-2">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!isOwner || isSubmitting}
            className="border rounded-md p-2 w-32 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Payment Day
        </label>
        <select
          value={day}
          onChange={(e) => setDay(e.target.value)}
          disabled={!isOwner || isSubmitting}
          className="border rounded-md p-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          {daysOfWeek.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {isOwner && (
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      )}
    </form>
  )
} 