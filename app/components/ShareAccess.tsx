'use client'

import { useState } from 'react'
import { db } from '../lib/firebase'
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'

interface ShareAccessProps {
  kidId: string;
  sharedWith: string[];
}

export default function ShareAccess({ kidId, sharedWith }: ShareAccessProps) {
  const [email, setEmail] = useState('')
  const [sharedEmails, setSharedEmails] = useState<string[]>(sharedWith)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsSubmitting(true)
    try {
      await updateDoc(doc(db, 'kids', kidId), {
        sharedWith: arrayUnion(email.toLowerCase())
      })
      setSharedEmails(prev => [...prev, email.toLowerCase()])
      setEmail('')
    } catch (error) {
      console.error('Error sharing access:', error)
      alert('Failed to share access. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemove = async (emailToRemove: string) => {
    try {
      await updateDoc(doc(db, 'kids', kidId), {
        sharedWith: arrayRemove(emailToRemove)
      })
      setSharedEmails(prev => prev.filter(e => e !== emailToRemove))
    } catch (error) {
      console.error('Error removing access:', error)
      alert('Failed to remove access. Please try again.')
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Share Access</h2>
      
      <form onSubmit={handleShare} className="mb-6">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email address"
            className="flex-1 border rounded-md p-2"
            required
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {isSubmitting ? 'Sharing...' : 'Share'}
          </button>
        </div>
      </form>

      {sharedEmails.length > 0 ? (
        <div>
          <h3 className="font-semibold mb-2">Shared with:</h3>
          <ul className="space-y-2">
            {sharedEmails.map((sharedEmail) => (
              <li key={sharedEmail} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                <span>{sharedEmail}</span>
                <button
                  onClick={() => handleRemove(sharedEmail)}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-gray-500">Not shared with anyone yet</p>
      )}
    </div>
  )
} 