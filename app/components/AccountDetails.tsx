'use client'

import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useRouter } from 'next/navigation'

interface AccountDetailsProps {
  kidId: string;
  initialName: string;
  initialSlug: string;
}

const AccountDetails = ({ kidId, initialName, initialSlug }: AccountDetailsProps) => {
  const [name, setName] = useState(initialName)
  const [slug, setSlug] = useState(initialSlug)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  const handleSave = async () => {
    if (!name || !slug) {
      alert('Name and URL slug are required')
      return
    }

    setIsSaving(true)
    try {
      await updateDoc(doc(db, 'kids', kidId), {
        name,
        slug
      })
      router.refresh()
    } catch (error) {
      console.error('Error updating account details:', error)
      alert('Failed to update account details. Please try again.')
    }
    setIsSaving(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSaving}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          URL Slug
        </label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={isSaving}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
        <p className="mt-1 text-sm text-gray-500">
          Dashboard URL: {typeof window !== 'undefined' ? `${window.location.origin}/${slug}` : ''}
        </p>
      </div>
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
    </div>
  )
}

export default AccountDetails 