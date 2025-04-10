'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { auth } from '@/app/lib/firebase'
import { signOut } from 'firebase/auth'
import { useRouter } from 'next/navigation'

export default function NavBar() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
      window.location.href = '/'
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (loading) {
    return <nav className="bg-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex space-x-7">
            <Link href="/" className="flex items-center py-4 px-2">
              <span className="font-semibold text-gray-500 text-lg">Track Allowance</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  }

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex space-x-7">
            <Link href="/" className="flex items-center py-4 px-2">
              <span className="font-semibold text-gray-500 text-lg">Track Allowance</span>
            </Link>

            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <Link 
                    href="/parent" 
                    className="py-4 px-2 text-gray-500 hover:text-gray-700 transition duration-300"
                  >
                    Parent Dashboard
                  </Link>
                  <Link 
                    href="/kids" 
                    className="py-4 px-2 text-gray-500 hover:text-gray-700 transition duration-300"
                  >
                    Kids List
                  </Link>
                </>
              ) : null}
              <Link 
                href="/help" 
                className="py-4 px-2 text-gray-500 hover:text-gray-700 transition duration-300"
              >
                How to Use
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {user ? (
              <button
                onClick={handleSignOut}
                className="py-2 px-4 text-gray-500 hover:text-gray-700 transition duration-300"
              >
                Sign Out
              </button>
            ) : (
              <Link 
                href="/parent"
                className="py-2 px-4 text-gray-500 hover:text-gray-700 transition duration-300"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
} 