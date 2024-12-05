'use client'

import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

interface DashboardVisibilityProps {
  kidId: string;
  isPublic: boolean;
}

export default function DashboardVisibility({ kidId, isPublic }: DashboardVisibilityProps) {
  const [isPublicState, setIsPublicState] = useState(isPublic)
  const [isSaving, setIsSaving] = useState(false)

  const handleVisibilityChange = async (newValue: boolean) => {
    setIsSaving(true)
    try {
      await updateDoc(doc(db, 'kids', kidId), {
        public: newValue
      })
      setIsPublicState(newValue)
    } catch (error) {
      console.error('Error updating visibility:', error)
      alert('Failed to update visibility. Please try again.')
    }
    setIsSaving(false)
  }

  return (
    <div>
      <div className="flex items-center space-x-4">
        <label className="inline-flex items-center">
          <input
            type="radio"
            checked={!isPublicState}
            onChange={() => handleVisibilityChange(false)}
            disabled={isSaving}
            className="form-radio"
          />
          <span className="ml-2">Private - Only you and shared users can view</span>
        </label>
      </div>
      <div className="flex items-center space-x-4 mt-2">
        <label className="inline-flex items-center">
          <input
            type="radio"
            checked={isPublicState}
            onChange={() => handleVisibilityChange(true)}
            disabled={isSaving}
            className="form-radio"
          />
          <span className="ml-2">Public - Anyone with the link can view</span>
        </label>
      </div>
    </div>
  )
} 