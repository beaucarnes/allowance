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

const KidSettings = ({ 
  kidId, 
  initialAllowance, 
  initialAllowanceDay,
  isOwner 
}: KidSettingsProps) => {
  const [allowance, setAllowance] = useState(initialAllowance.toString())
  const [allowanceDay, setAllowanceDay] = useState(initialAllowanceDay)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateDoc(doc(db, 'kids', kidId), {
        weeklyAllowance: parseFloat(allowance) || 0,
        allowanceDay
      })
    } catch (error) {
      console.error('Error updating allowance settings:', error)
      alert('Failed to update allowance settings. Please try again.')
    }
    setIsSaving(false)
  }

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Weekly Amount
        </label>
        <div className="flex items-center">
          <span className="text-gray-500 mr-2">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={allowance}
            onChange={(e) => setAllowance(e.target.value)}
            disabled={isSaving || !isOwner}
            className="w-32 px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Payment Day
        </label>
        <select
          value={allowanceDay}
          onChange={(e) => setAllowanceDay(e.target.value)}
          disabled={isSaving || !isOwner}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          {days.map(day => (
            <option key={day} value={day}>{day}</option>
          ))}
        </select>
      </div>

      {isOwner && (
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`${
            isSaving 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white px-4 py-2 rounded`}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      )}
    </div>
  )
}

export default KidSettings 