'use client'

import { useState } from 'react'
import { db, auth } from '../lib/firebase'
import { doc, collection, getDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore'

interface AddTransactionProps {
  kidId: string;
}

export default function AddTransaction({ kidId }: AddTransactionProps) {
  const [transaction, setTransaction] = useState({
    amount: '',
    description: '',
    type: 'debit' as 'debit' | 'credit',
    date: new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD format
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const amount = parseFloat(transaction.amount)
    if (!amount || !transaction.description) return
    
    const finalAmount = transaction.type === 'debit' ? -amount : amount
    const description = transaction.description
    const transactionDate = new Date(transaction.date)
    
    try {
      console.log('Starting transaction creation...')
      console.log('Current user:', auth.currentUser?.uid)
      console.log('Current user email:', auth.currentUser?.email)
      
      const kidRef = doc(db, 'kids', kidId)
      const kidDoc = await getDoc(kidRef)
      
      console.log('Kid doc:', {
        exists: kidDoc.exists(),
        data: kidDoc.data(),
        id: kidId
      })

      if (!kidDoc.exists()) {
        throw "Kid document does not exist!"
      }

      const currentTotal = kidDoc.data().total || 0
      const newTotal = currentTotal + finalAmount

      // First create the transaction
      console.log('Creating transaction with data:', {
        amount: finalAmount,
        description,
        date: serverTimestamp()
      })

      const transactionsRef = collection(db, 'kids', kidId, 'transactions')
      await addDoc(transactionsRef, {
        amount: finalAmount,
        description: description,
        date: serverTimestamp(),
        parentName: auth.currentUser?.displayName || 'Unknown Parent',
        parentEmail: auth.currentUser?.email || 'unknown@email.com'
      })

      console.log('Transaction created successfully')

      // Then update the total
      await updateDoc(kidRef, {
        total: newTotal
      })

      console.log('Total updated successfully')

      // Reset form
      setTransaction({ 
        amount: '', 
        description: '', 
        type: 'debit',
        date: new Date().toISOString().split('T')[0]
      })
    } catch (err) {
      const error = err as { code?: string; message?: string }
      console.error('Error adding transaction:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        kidId,
        auth: auth.currentUser?.uid
      })
      alert('Failed to add transaction. Please try again.')
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h2 className="text-xl font-bold mb-4">Add Transaction</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              value={transaction.amount}
              onChange={(e) => setTransaction({
                ...transaction,
                amount: e.target.value
              })}
              className="w-full border rounded-md p-2"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={transaction.description}
              onChange={(e) => setTransaction({
                ...transaction,
                description: e.target.value
              })}
              className="w-full border rounded-md p-2"
              placeholder="Enter description"
              required
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={transaction.date}
              onChange={(e) => setTransaction({
                ...transaction,
                date: e.target.value
              })}
              className="w-full border rounded-md p-2"
              max={new Date().toISOString().split('T')[0]}  // Can't select future dates
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={transaction.type}
              onChange={(e) => setTransaction({
                ...transaction,
                type: e.target.value as 'credit' | 'debit'
              })}
              className="w-full border rounded-md p-2"
            >
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
          </div>
        </div>
        
        <button 
          type="submit"
          className={`w-full py-2 px-4 rounded-md text-white font-bold ${
            transaction.type === 'credit' 
              ? 'bg-green-500 hover:bg-green-600' 
              : 'bg-red-500 hover:bg-red-600'
          }`}
        >
          Add {transaction.type === 'credit' ? 'Credit' : 'Debit'}
        </button>
      </form>
    </div>
  )
} 