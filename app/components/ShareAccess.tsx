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
  const [isSharing, setIsSharing] = useState(false)
  const [isRevoking, setIsRevoking] = useState<string | null>(null)

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsSharing(true)
    try {
      const kidRef = doc(db, 'kids', kidId)
      await updateDoc(kidRef, {
        sharedWith: arrayUnion(email)
      })
      setEmail('')
    } catch (error) {
      console.error('Error sharing access:', error)
      alert('Failed to share access. Please try again.')
    } finally {
      setIsSharing(false)
    }
  }

  const handleRevoke = async (emailToRevoke: string) => {
    if (!confirm(`Are you sure you want to revoke access for ${emailToRevoke}?`)) return

    setIsRevoking(emailToRevoke)
    try {
      const kidRef = doc(db, 'kids', kidId)
      await updateDoc(kidRef, {
        sharedWith: arrayRemove(emailToRevoke)
      })
    } catch (error) {
      console.error('Error revoking access:', error)
      alert('Failed to revoke access. Please try again.')
    } finally {
      setIsRevoking(null)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Share Access</h2>
      <form onSubmit={handleShare} className="flex gap-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter parent's email"
          className="flex-1 border rounded-md p-2"
          required
        />
        <button
          type="submit"
          disabled={isSharing}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded disabled:opacity-50"
        >
          Share
        </button>
      </form>
      {sharedWith.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Shared with:</h3>
          <ul className="space-y-2">
            {sharedWith.map((email) => (
              <li key={email} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                <span className="text-gray-600">{email}</span>
                <button
                  onClick={() => handleRevoke(email)}
                  disabled={isRevoking === email}
                  className="text-red-500 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                >
                  {isRevoking === email ? 'Revoking...' : 'Revoke Access'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
} 