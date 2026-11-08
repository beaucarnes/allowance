'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { auth } from '@/app/lib/firebase'
import { signOut } from 'firebase/auth'

export default function NavBar() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      window.location.href = '/'
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <nav className="bg-white/95 backdrop-blur border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center gap-2 py-2">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-sm shadow-sm">
                🏦
              </span>
              <span className="font-extrabold text-gray-900 text-lg tracking-tight">
                TrackAllowance
              </span>
            </Link>

            <div className="hidden md:flex items-center space-x-1">
              {user && (
                <>
                  <Link
                    href="/parent"
                    className="py-2 px-3 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
                  >
                    Parent Dashboard
                  </Link>
                  <Link
                    href="/kids"
                    className="py-2 px-3 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
                  >
                    Kids List
                  </Link>
                  <Link
                    href="/parent/contributions"
                    className="py-2 px-3 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
                  >
                    Contributions
                  </Link>
                  <Link
                    href="/parent/ai-bot"
                    className="py-2 px-3 rounded-lg text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 transition"
                  >
                    🤖 AI Bot API
                  </Link>
                </>
              )}
              <Link
                href="/pricing"
                className="py-2 px-3 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
              >
                Pricing
              </Link>
              <Link
                href="/help"
                className="py-2 px-3 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
              >
                How to Use
              </Link>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-3">
            {loading ? null : user ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/pricing"
                  className="text-xs font-bold px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700 border border-indigo-200 hover:border-indigo-300"
                >
                  ✨ Family Bank Pro
                </Link>
                <button
                  onClick={handleSignOut}
                  className="py-2 px-3.5 rounded-xl text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/parent"
                  className="py-2 px-4 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/parent"
                  className="py-2 px-4 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
                >
                  Start Free →
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 pt-2 border-t border-gray-100 space-y-1">
            {user && (
              <>
                <Link
                  href="/parent"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 px-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Parent Dashboard
                </Link>
                <Link
                  href="/kids"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 px-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Kids List
                </Link>
                <Link
                  href="/parent/contributions"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 px-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Parent Contributions
                </Link>
                <Link
                  href="/parent/ai-bot"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 px-3 rounded-lg text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                >
                  🤖 AI Bot API
                </Link>
              </>
            )}
            <Link
              href="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 px-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Pricing &amp; Plans
            </Link>
            <Link
              href="/help"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 px-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              How to Use
            </Link>
            {user ? (
              <button
                onClick={handleSignOut}
                className="w-full text-left py-2 px-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Sign Out
              </button>
            ) : (
              <Link
                href="/parent"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 px-3 rounded-lg text-sm font-bold text-blue-600 hover:bg-blue-50"
              >
                Sign In / Get Started Free
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
