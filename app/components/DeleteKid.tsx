'use client'

import { useState } from 'react'
import { db } from '../lib/firebase'
import { doc, deleteDoc } from 'firebase/firestore'
import { useRouter } from 'next/navigation'

interface DeleteKidProps {
  kidId: string;
  kidName: string;
}

export default function DeleteKid({ kidId, kidName }: DeleteKidProps) {
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (!showConfirmation) {
      setShowConfirmation(true)
      return
    }

    setIsDeleting(true)
    try {
      await deleteDoc(doc(db, 'kids', kidId))
      router.push('/parent')
    } catch (error) {
      console.error('Error deleting kid:', error)
      alert('Failed to delete. Please try again.')
      setIsDeleting(false)
      setShowConfirmation(false)
    }
  }

  return (
    <div className="border-t pt-6 mt-6">
      <h2 className="text-xl font-bold mb-4 text-red-600">Delete Account</h2>
      <p className="text-gray-600 mb-4">
        This action cannot be undone. All data including transaction history will be permanently deleted.
      </p>
      
      {showConfirmation ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 font-medium mb-4">
            Are you sure you want to delete {kidName}&apos;s account? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Yes, Delete Account'}
            </button>
            <button
              onClick={() => setShowConfirmation(false)}
              disabled={isDeleting}
              className="text-gray-600 hover:text-gray-800 px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleDelete}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
        >
          Delete Account
        </button>
      )}
    </div>
  )
} 