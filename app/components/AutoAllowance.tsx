'use client'

import { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { doc, updateDoc } from 'firebase/firestore'

interface AutoAllowanceProps {
  kidId: string
  currentAllowance: number
  currentDay?: string
  onAllowanceUpdate?: (newAllowance: number, day: string) => void
}

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
]

export default function AutoAllowance({ 
  kidId, 
  currentAllowance, 
  currentDay = 'Monday',
  onAllowanceUpdate 
}: AutoAllowanceProps) {
  const [allowance, setAllowance] = useState(currentAllowance)
  const [selectedDay, setSelectedDay] = useState(currentDay)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setAllowance(currentAllowance)
    setSelectedDay(currentDay)
  }, [currentAllowance, currentDay])

  const handleSetAllowance = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateDoc(doc(db, 'kids', kidId), {
        weeklyAllowance: allowance,
        allowanceDay: selectedDay
      })
      setIsEditing(false)
      onAllowanceUpdate?.(allowance, selectedDay)
    } catch (error) {
      console.error('Error setting auto allowance', error)
      alert('Failed to set auto allowance. Please try again.')
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h3 className="text-xl font-bold mb-4">Weekly Allowance</h3>
      {isEditing ? (
        <form onSubmit={handleSetAllowance} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={allowance}
                onChange={(e) => setAllowance(parseFloat(e.target.value))}
                className="w-full border rounded-md p-2"
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Day of Week
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="w-full border rounded-md p-2"
                required
              >
                {DAYS_OF_WEEK.map(day => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setAllowance(currentAllowance)
                setSelectedDay(currentDay)
                setIsEditing(false)
              }}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg">
              Current allowance: <span className="font-bold">${currentAllowance.toFixed(2)}/week</span>
            </p>
            <p className="text-sm text-gray-600">
              Paid every <span className="font-medium">{currentDay}</span>
            </p>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  )
}

