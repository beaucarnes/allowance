'use client'

import { useState, useCallback } from 'react'
import { db } from '../lib/firebase'
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore'

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout
  return ((...args: any[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }) as T
}

interface AddKidFormProps {
  userId: string
  userEmail: string
  onClose: () => void
  onSuccess: () => void
}

export default function AddKidForm({ userId, userEmail, onClose, onSuccess }: AddKidFormProps) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createSlug = (input: string) => {
    return input.toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  const handleNameChange = (value: string) => {
    setName(value)
    const newSlug = createSlug(value)
    setSlug(newSlug)
    checkSlugAvailability(newSlug)
  }

  const handleSlugChange = (value: string) => {
    const newSlug = createSlug(value)
    setSlug(newSlug)
    checkSlugAvailability(newSlug)
  }

  const checkSlugAvailability = useCallback(
    debounce(async (slugToCheck: string) => {
      if (!slugToCheck) {
        setIsAvailable(null)
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
    }, 300),
    []
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !slug || !isAvailable) return

    setIsSubmitting(true)
    try {
      await addDoc(collection(db, 'kids'), {
        name,
        slug,
        parentId: userId,
        total: 0,
        sharedWith: [],
        public: false
      })
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error adding kid:', error)
      alert('Failed to add kid. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Add New Kid</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kid's Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full border rounded-md p-2"
              placeholder="Enter kid's name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dashboard URL
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500">/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                className={`flex-1 border rounded-md p-2 ${
                  isAvailable === false ? 'border-red-500' : ''
                }`}
                placeholder="unique-url"
                required
              />
            </div>
            {isChecking ? (
              <p className="text-sm text-gray-500 mt-1">Checking availability...</p>
            ) : slug && isAvailable === false ? (
              <p className="text-sm text-red-500 mt-1">This URL is already taken</p>
            ) : slug && isAvailable ? (
              <p className="text-sm text-green-500 mt-1">This URL is available</p>
            ) : null}
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isAvailable || isSubmitting}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add Kid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}  