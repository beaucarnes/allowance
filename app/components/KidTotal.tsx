'use client'

import { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'

interface KidTotalProps {
  kidId: string
}

export default function KidTotal({ kidId }: KidTotalProps) {
  const [total, setTotal] = useState<number | null>(null)

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'kids', kidId), {
      includeMetadataChanges: true
    }, (doc) => {
      if (doc.exists() && !doc.metadata.hasPendingWrites) {
        setTotal(doc.data()?.total || 0)
      }
    })

    return () => unsubscribe()
  }, [kidId])

  if (total === null) {
    return <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h2 className="text-2xl font-bold mb-2">Current Total</h2>
      <div className="text-3xl font-bold text-gray-400">Loading...</div>
    </div>
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h2 className="text-2xl font-bold mb-2">Current Total</h2>
      <p className={`text-3xl font-bold ${total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        ${total.toFixed(2)}
      </p>
    </div>
  )
} 