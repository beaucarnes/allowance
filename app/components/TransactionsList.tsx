'use client'

import { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { collection, query, orderBy, limit, onSnapshot, startAfter, doc, getDoc, getDocs, deleteDoc, updateDoc, increment } from 'firebase/firestore'

interface TransactionsListProps {
  kidId: string;
  showActions?: boolean;
  isPublic?: boolean;
  initialTransactions?: Transaction[];
}

interface Transaction {
  id: string;
  amount: number;
  description: string;
  date: Date;
}

export default function TransactionsList({ 
  kidId, 
  showActions = false, 
  isPublic = false,
  initialTransactions = [] 
}: TransactionsListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [pageData, setPageData] = useState<{
    docs: Transaction[];
    lastVisible: any;
    hasMore: boolean;
  }[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    amount: '',
    description: ''
  })

  useEffect(() => {
    setIsLoading(true)
    const transactionsRef = collection(db, 'kids', kidId, 'transactions')
    const q = query(
      transactionsRef,
      orderBy('date', 'desc'),
      limit(10)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        amount: doc.data().amount,
        description: doc.data().description,
        date: doc.data().date?.toDate() || new Date()
      }))

      const hasMoreDocs = !snapshot.empty && snapshot.docs.length === 10
      setTransactions(docs)
      setHasMore(hasMoreDocs)
      setPageData([{
        docs,
        lastVisible: snapshot.docs[snapshot.docs.length - 1],
        hasMore: hasMoreDocs
      }])
      setIsLoading(false)
    }, (error) => {
      console.error('Error listening to transactions:', error)
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [kidId])

  const loadPage = async (direction: 'next' | 'prev') => {
    if (direction === 'prev') {
      if (currentPage <= 1) return
      const prevPageData = pageData[currentPage - 2]
      if (prevPageData) {
        setTransactions(prevPageData.docs)
        setHasMore(prevPageData.hasMore)
        setCurrentPage(prev => prev - 1)
        return
      }
    }

    if (direction === 'next') {
      const lastVisible = pageData[currentPage - 1]?.lastVisible
      if (!lastVisible) return

      setIsLoading(true)
      const transactionsRef = collection(db, 'kids', kidId, 'transactions')
      const q = query(
        transactionsRef,
        orderBy('date', 'desc'),
        startAfter(lastVisible),
        limit(10)
      )

      try {
        const snapshot = await getDocs(q)
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          amount: doc.data().amount,
          description: doc.data().description,
          date: doc.data().date?.toDate() || new Date()
        }))

        const hasMoreDocs = !snapshot.empty && snapshot.docs.length === 10
        setTransactions(docs)
        setHasMore(hasMoreDocs)
        setPageData(prev => [...prev, {
          docs,
          lastVisible: snapshot.docs[snapshot.docs.length - 1],
          hasMore: hasMoreDocs
        }])
        setCurrentPage(prev => prev + 1)
      } catch (error) {
        console.error('Error loading next page:', error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleDelete = async (transactionId: string, amount: number) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return

    try {
      // Delete the transaction
      await deleteDoc(doc(db, 'kids', kidId, 'transactions', transactionId))

      // Update the kid's total
      const kidRef = doc(db, 'kids', kidId)
      await updateDoc(kidRef, {
        total: increment(-amount)
      })
    } catch (error) {
      console.error('Error deleting transaction:', error)
      alert('Failed to delete transaction. Please try again.')
    }
  }

  const handleEdit = async (transactionId: string, oldAmount: number) => {
    if (!editForm.amount || !editForm.description) return

    try {
      const newAmount = parseFloat(editForm.amount)
      const amountDiff = newAmount - oldAmount

      // Update the transaction
      await updateDoc(doc(db, 'kids', kidId, 'transactions', transactionId), {
        amount: newAmount,
        description: editForm.description
      })

      // Update the kid's total
      const kidRef = doc(db, 'kids', kidId)
      await updateDoc(kidRef, {
        total: increment(amountDiff)
      })

      setEditingId(null)
    } catch (error) {
      console.error('Error updating transaction:', error)
      alert('Failed to update transaction. Please try again.')
    }
  }

  if (isLoading && transactions.length === 0) {
    return <div>Loading transactions...</div>
  }

  return (
    <div>
      <table className="min-w-full">
        <thead>
          <tr>
            <th className="text-left py-2">Date</th>
            <th className="text-left py-2">Description</th>
            <th className="text-right py-2">Amount</th>
            {showActions && <th className="text-right py-2">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id} className="border-t">
              <td className="py-2">
                {transaction.date.toLocaleDateString()}
              </td>
              <td className="py-2">
                {editingId === transaction.id ? (
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({
                      ...prev,
                      description: e.target.value
                    }))}
                    className="w-full border rounded px-2 py-1"
                  />
                ) : transaction.description}
              </td>
              <td className={`py-2 text-right ${
                transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {editingId === transaction.id ? (
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.amount}
                    onChange={(e) => setEditForm(prev => ({
                      ...prev,
                      amount: e.target.value
                    }))}
                    className="w-full border rounded px-2 py-1"
                  />
                ) : `$${transaction.amount.toFixed(2)}`}
              </td>
              {showActions && (
                <td className="py-2 text-right space-x-2">
                  {editingId === transaction.id ? (
                    <>
                      <button
                        onClick={() => handleEdit(transaction.id, transaction.amount)}
                        className="text-green-600 hover:text-green-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-gray-600 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(transaction.id)
                          setEditForm({
                            amount: transaction.amount.toString(),
                            description: transaction.description
                          })
                        }}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(transaction.id, transaction.amount)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              )}
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr>
              <td colSpan={3} className="text-center py-4 text-gray-500">
                No transactions found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {(currentPage > 1 || hasMore) && (
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => loadPage('prev')}
            disabled={currentPage <= 1 || isLoading}
            className={`px-4 py-2 text-sm ${
              currentPage <= 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-blue-500 hover:text-blue-700'
            }`}
          >
            Previous
          </button>

          <span className="text-sm text-gray-600">
            Page {currentPage}
          </span>

          <button
            onClick={() => loadPage('next')}
            disabled={!hasMore || isLoading}
            className={`px-4 py-2 text-sm ${
              !hasMore
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-blue-500 hover:text-blue-700'
            }`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
} 