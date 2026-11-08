'use client'

import { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  startAfter,
  doc,
  getDocs,
  deleteDoc,
  updateDoc,
  increment,
} from 'firebase/firestore'

interface TransactionsListProps {
  kidId: string
  showActions?: boolean
  isPublic?: boolean
  initialTransactions?: Transaction[]
}

interface Transaction {
  id: string
  amount: number
  description: string
  date: Date
  parentName?: string
}

export default function TransactionsList({
  kidId,
  showActions = false,
  initialTransactions = [],
}: TransactionsListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [pageData, setPageData] = useState<
    {
      docs: Transaction[]
      lastVisible: any
      hasMore: boolean
    }[]
  >([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    amount: '',
    description: '',
  })
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setIsLoading(true)
    const transactionsRef = collection(db, 'kids', kidId, 'transactions')
    const q = query(transactionsRef, orderBy('date', 'desc'), limit(15))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          amount: Number(d.data().amount || 0),
          description: d.data().description || '',
          date: d.data().date?.toDate() || new Date(),
          parentName: d.data().parentName || undefined,
        }))

        const hasMoreDocs = !snapshot.empty && snapshot.docs.length === 15
        setTransactions(docs)
        setHasMore(hasMoreDocs)
        setCurrentPage(1)
        setPageData([
          {
            docs,
            lastVisible: snapshot.docs[snapshot.docs.length - 1],
            hasMore: hasMoreDocs,
          },
        ])
        setIsLoading(false)
      },
      (error) => {
        console.error('Error listening to transactions:', error)
        setIsLoading(false)
      }
    )

    return () => unsubscribe()
  }, [kidId])

  const loadPage = async (direction: 'next' | 'prev') => {
    if (direction === 'prev') {
      if (currentPage <= 1) return
      const prevPageData = pageData[currentPage - 2]
      if (prevPageData) {
        setTransactions(prevPageData.docs)
        setHasMore(prevPageData.hasMore)
        setCurrentPage((prev) => prev - 1)
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
        limit(15)
      )

      try {
        const snapshot = await getDocs(q)
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          amount: Number(d.data().amount || 0),
          description: d.data().description || '',
          date: d.data().date?.toDate() || new Date(),
          parentName: d.data().parentName || undefined,
        }))

        const hasMoreDocs = !snapshot.empty && snapshot.docs.length === 15
        setTransactions(docs)
        setHasMore(hasMoreDocs)
        setPageData((prev) => [
          ...prev,
          {
            docs,
            lastVisible: snapshot.docs[snapshot.docs.length - 1],
            hasMore: hasMoreDocs,
          },
        ])
        setCurrentPage((prev) => prev + 1)
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
      await deleteDoc(doc(db, 'kids', kidId, 'transactions', transactionId))
      const kidRef = doc(db, 'kids', kidId)
      await updateDoc(kidRef, {
        total: increment(-amount),
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

      await updateDoc(doc(db, 'kids', kidId, 'transactions', transactionId), {
        amount: newAmount,
        description: editForm.description,
      })

      const kidRef = doc(db, 'kids', kidId)
      await updateDoc(kidRef, {
        total: increment(amountDiff),
      })

      setEditingId(null)
    } catch (error) {
      console.error('Error updating transaction:', error)
      alert('Failed to update transaction. Please try again.')
    }
  }

  const filteredTransactions = transactions.filter((t) => {
    if (filterType === 'credit' && t.amount < 0) return false
    if (filterType === 'debit' && t.amount >= 0) return false
    if (
      searchQuery.trim() &&
      !t.description.toLowerCase().includes(searchQuery.trim().toLowerCase())
    ) {
      return false
    }
    return true
  })

  if (isLoading && transactions.length === 0) {
    return <div className="py-6 text-center text-gray-500 text-sm">Loading transactions...</div>
  }

  return (
    <div className="space-y-4">
      {/* Filter & Search Bar */}
      {transactions.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
          <div className="inline-flex p-1 bg-gray-100 rounded-xl self-start">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'credit', label: '＋ Credits' },
                { id: 'debit', label: '− Debits' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  filterType === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search description..."
            className="border border-gray-200 rounded-xl px-3.5 py-1.5 text-sm text-gray-800 focus:border-blue-500 outline-none sm:w-64"
          />
        </div>
      )}

      {/* Transactions List */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase tracking-wider text-gray-400">
              <th className="text-left py-2.5 font-semibold">Date</th>
              <th className="text-left py-2.5 font-semibold">Description</th>
              <th className="text-right py-2.5 font-semibold">Amount</th>
              {showActions && <th className="text-right py-2.5 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredTransactions.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="py-3 pr-3 whitespace-nowrap text-xs text-gray-500">
                  {transaction.date.toLocaleDateString()}
                </td>
                <td className="py-3 pr-3 font-medium text-gray-900">
                  {editingId === transaction.id ? (
                    <input
                      type="text"
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-sm"
                    />
                  ) : (
                    <span>{transaction.description}</span>
                  )}
                </td>
                <td className="py-3 text-right whitespace-nowrap">
                  {editingId === transaction.id ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.amount}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          amount: e.target.value,
                        }))
                      }
                      className="w-28 border border-gray-300 rounded-lg px-2.5 py-1 text-right text-sm"
                    />
                  ) : (
                    <span
                      className={`inline-block font-extrabold px-2.5 py-0.5 rounded-lg text-xs ${
                        transaction.amount >= 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {transaction.amount >= 0
                        ? `+$${transaction.amount.toFixed(2)}`
                        : `-$${Math.abs(transaction.amount).toFixed(2)}`}
                    </span>
                  )}
                </td>
                {showActions && (
                  <td className="py-3 pl-3 text-right whitespace-nowrap space-x-2 text-xs">
                    {editingId === transaction.id ? (
                      <>
                        <button
                          onClick={() => handleEdit(transaction.id, transaction.amount)}
                          className="font-bold text-emerald-600 hover:text-emerald-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="font-medium text-gray-500 hover:text-gray-700"
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
                              description: transaction.description,
                            })
                          }}
                          className="font-semibold text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(transaction.id, transaction.amount)}
                          className="font-semibold text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={showActions ? 4 : 3} className="text-center py-8 text-gray-400">
                  No transactions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(currentPage > 1 || hasMore) && (
        <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => loadPage('prev')}
            disabled={currentPage <= 1 || isLoading}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border ${
              currentPage <= 1
                ? 'text-gray-300 border-gray-100 cursor-not-allowed'
                : 'text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            ← Previous
          </button>

          <span className="text-xs font-semibold text-gray-500">Page {currentPage}</span>

          <button
            onClick={() => loadPage('next')}
            disabled={!hasMore || isLoading}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border ${
              !hasMore
                ? 'text-gray-300 border-gray-100 cursor-not-allowed'
                : 'text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
