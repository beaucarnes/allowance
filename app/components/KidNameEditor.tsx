'use client'

import { useState } from 'react'
import { db } from '../lib/firebase'
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { useRouter } from 'next/navigation'

interface KidNameEditorProps {
  kidId: string
  initialName: string
  initialSlug: string
  isOwner: boolean
}

export default function KidNameEditor({ kidId, initialName, initialSlug, isOwner }: KidNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [slug, setSlug] = useState(initialSlug)
  const [isChecking, setIsChecking] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const createSlug = (input: string) => {
    return input.toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  const handleNameChange = (value: string) => {
    setName(value)
    if (slug === initialSlug) {
      const newSlug = createSlug(value)
      setSlug(newSlug)
      checkSlugAvailability(newSlug)
    }
  }

  const handleSlugChange = (value: string) => {
    const newSlug = createSlug(value)
    setSlug(newSlug)
    checkSlugAvailability(newSlug)
  }

  const checkSlugAvailability = async (slugToCheck: string) => {
    if (!slugToCheck || slugToCheck === initialSlug) {
      setIsAvailable(true)
      return
    }

    setIsChecking(true)
    try {
      const q = query(
        collection(db, 'kids'),
        where('slug', '==', slugToCheck)
      )
      const snapshot = await getDocs(q)
      setIsAvailable(snapshot.empty)
    } catch (error) {
      console.error('Error checking slug availability:', error)
    } finally {
      setIsChecking(false)
    }
  }

  const handleSubmit = async () => {
    if (!name || !slug || (!isAvailable && slug !== initialSlug)) return

    setIsSubmitting(true)
    try {
      await updateDoc(doc(db, 'kids', kidId), {
        name,
        slug
      })
      setIsEditing(false)
      if (slug !== initialSlug) {
        // Redirect to new URL if slug changed
        router.push(`/parent/kid/${slug}`)
      }
    } catch (error) {
      console.error('Error updating kid:', error)
      alert('Failed to update. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-3xl font-bold">Manage {initialName}'s Account</h1>
        {isOwner && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-gray-400 hover:text-gray-600"
            title="Edit name"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mb-6">
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Edit Account Details</h2>
          <button
            onClick={() => setIsEditing(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full border rounded-md p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dashboard URL
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500">/kids/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                className={`flex-1 border rounded-md p-2 ${
                  isAvailable === false ? 'border-red-500' : ''
                }`}
              />
            </div>
            {isChecking ? (
              <p className="text-sm text-gray-500 mt-1">Checking availability...</p>
            ) : slug && slug !== initialSlug && isAvailable === false ? (
              <p className="text-sm text-red-500 mt-1">This URL is already taken</p>
            ) : slug && slug !== initialSlug && isAvailable ? (
              <p className="text-sm text-green-500 mt-1">This URL is available</p>
            ) : null}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || (!isAvailable && slug !== initialSlug)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 