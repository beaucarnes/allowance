'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '../../lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import Link from 'next/link'

interface Contribution {
  id: string;
  amount: number;
  description: string;
  date: Date;
  kidName: string;
  parentName: string;
}

interface ParentTotal {
  parentName: string;
  total: number;
}

export default function Contributions() {
  const [user, setUser] = useState<any>(null)
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [kids, setKids] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [parentTotals, setParentTotals] = useState<ParentTotal[]>([])
  const router = useRouter()

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user)
      if (user) {
        fetchKids(user.uid, user.email || '')
      } else {
        // Not logged in, redirect to parent dashboard
        router.push('/parent')
      }
    })

    return () => unsubscribe()
  }, [router])

  useEffect(() => {
    if (kids.length > 0) {
      fetchContributions()
    }
  }, [kids, selectedMonth, selectedYear])

  const fetchKids = async (parentId: string, email: string) => {
    try {
      // Query for kids where user is the parent
      const parentKidsQuery = query(
        collection(db, 'kids'), 
        where('parentId', '==', parentId)
      )
      const parentKidsSnapshot = await getDocs(parentKidsQuery)
      const parentKids = parentKidsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      // Query for kids shared with the user
      const sharedKidsQuery = query(
        collection(db, 'kids'),
        where('sharedWith', 'array-contains', email)
      )
      const sharedKidsSnapshot = await getDocs(sharedKidsQuery)
      const sharedKids = sharedKidsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      // Combine and deduplicate the results
      const allKids = [...parentKids, ...sharedKids]
      const uniqueKids = Array.from(new Map(allKids.map(kid => [kid.id, kid])).values())
      
      setKids(uniqueKids)
    } catch (error) {
      console.error('Error fetching kids:', error)
    }
  }

  const fetchContributions = async () => {
    setLoading(true)
    try {
      const allContributions: Contribution[] = []
      
      // Get start and end date for the selected month
      const startDate = new Date(selectedYear, selectedMonth, 1)
      const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999)
      
      console.log('Date range:', { 
        startDate: startDate.toISOString(), 
        endDate: endDate.toISOString(),
        selectedMonth,
        selectedYear
      })
      
      for (const kid of kids) {
        console.log('Processing kid:', kid.name, kid.id)
        
        // Get all transactions for this kid
        const transactionsRef = collection(db, 'kids', kid.id, 'transactions')
        const snapshot = await getDocs(transactionsRef)
        
        console.log('Found total transactions:', snapshot.size)
        
        // Filter client-side for debits in date range
        const kidContributions = snapshot.docs
          .map(doc => {
            const data = doc.data()
            
            // Skip if not a debit (negative amount)
            if (!data.amount || data.amount >= 0) {
              return null
            }
            
            // Skip if no date
            if (!data.date) {
              return null
            }
            
            const txDate = data.date.toDate()
            
            // Skip if outside date range
            if (txDate < startDate || txDate > endDate) {
              return null
            }
            
            return {
              id: doc.id,
              amount: Math.abs(data.amount), // Convert negative to positive for display
              description: data.description || 'No description',
              date: txDate,
              kidName: kid.name,
              parentName: data.parentName || 'Unknown Parent'
            }
          })
          .filter(Boolean) as Contribution[] // Remove null items
        
        console.log('Filtered debit contributions for kid:', kidContributions.length)
        allContributions.push(...kidContributions)
      }
      
      console.log('Total contributions found:', allContributions.length)
      
      // Sort by date descending
      allContributions.sort((a, b) => b.date.getTime() - a.date.getTime())
      
      setContributions(allContributions)
      
      // Calculate parent totals
      const totals: {[key: string]: number} = {}
      allContributions.forEach(contribution => {
        const { parentName, amount } = contribution
        totals[parentName] = (totals[parentName] || 0) + amount
      })
      
      const parentTotalsList: ParentTotal[] = Object.entries(totals).map(([parentName, total]) => ({
        parentName,
        total
      }))
      
      // Sort by total descending
      parentTotalsList.sort((a, b) => b.total - a.total)
      
      setParentTotals(parentTotalsList)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching contributions:', error)
      setLoading(false)
    }
  }
  
  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMonth(parseInt(e.target.value))
  }
  
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedYear(parseInt(e.target.value))
  }
  
  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Parent Contributions</h1>
          <p className="text-gray-600 mt-1">
            View all debit transactions for all kids
          </p>
        </div>
        <Link
          href="/parent"
          className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
        >
          Back to Dashboard
        </Link>
      </div>
      
      {/* Month selector */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <select 
              id="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              className="border rounded-md p-2"
            >
              {monthNames.map((month, index) => (
                <option key={index} value={index}>{month}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select 
              id="year"
              value={selectedYear}
              onChange={handleYearChange}
              className="border rounded-md p-2"
            >
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - i
                return <option key={year} value={year}>{year}</option>
              })}
            </select>
          </div>
        </div>
      </div>
      
      {/* Parent totals */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-2xl font-bold mb-4">Parent Totals for {monthNames[selectedMonth]} {selectedYear}</h2>
        
        {parentTotals.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {parentTotals.map(parent => (
              <div key={parent.parentName} className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium">{parent.parentName}</p>
                <p className="text-lg font-bold text-green-600">${parent.total.toFixed(2)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No contributions found for this month</p>
        )}
      </div>
      
      {/* Contributions table */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Contributions Detail</h2>
        
        {loading ? (
          <div className="text-center py-8">Loading contributions...</div>
        ) : contributions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">Kid</th>
                  <th className="px-4 py-2 text-left">Parent</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map(contribution => (
                  <tr key={contribution.id} className="border-t">
                    <td className="px-4 py-2">
                      {contribution.date.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      {contribution.description}
                    </td>
                    <td className="px-4 py-2 font-medium">
                      ${contribution.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2">
                      {contribution.kidName}
                    </td>
                    <td className="px-4 py-2">
                      {contribution.parentName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600">No contributions found for {monthNames[selectedMonth]} {selectedYear}</p>
          </div>
        )}
      </div>
    </div>
  )
} 