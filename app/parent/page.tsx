'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '../lib/firebase'
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore'
import Link from 'next/link'
import AddKidForm from '../components/AddKidForm'

function createSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export default function ParentDashboard() {
  const [user, setUser] = useState<any>(null)
  const [kids, setKids] = useState<any[]>([])
  const router = useRouter()
  const [showAddKidForm, setShowAddKidForm] = useState(false)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user)
      if (user) {
        // Get a fresh token and create/refresh session
        const idToken = await user.getIdToken(true)  // true forces token refresh
        try {
          const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken }),
            credentials: 'include',
          })

          if (response.ok) {
            fetchKids(user.uid, user.email || '')
          } else {
            console.error('Failed to refresh session')
          }
        } catch (error) {
          console.error('Error refreshing session:', error)
        }
      }
    })

    return () => unsubscribe()
  }, [])

  const fetchKids = async (parentId: string, email: string) => {
    try {
      console.log('Fetching kids for:', { parentId, email });

      // Query for kids where user is the parent
      console.log('Building parent query...');
      const parentKidsQuery = query(
        collection(db, 'kids'), 
        where('parentId', '==', parentId)
      );

      console.log('Executing parent query...');
      const parentKidsSnapshot = await getDocs(parentKidsQuery);
      console.log('Parent kids result:', {
        empty: parentKidsSnapshot.empty,
        size: parentKidsSnapshot.size
      });

      const parentKids = parentKidsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Query for kids shared with the user
      console.log('Building shared query...');
      const sharedKidsQuery = query(
        collection(db, 'kids'),
        where('sharedWith', 'array-contains', email)
      );

      console.log('Executing shared query...');
      const sharedKidsSnapshot = await getDocs(sharedKidsQuery);
      console.log('Shared kids result:', {
        empty: sharedKidsSnapshot.empty,
        size: sharedKidsSnapshot.size
      });

      const sharedKids = sharedKidsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Combine and deduplicate the results
      const allKids = [...parentKids, ...sharedKids];
      const uniqueKids = Array.from(new Map(allKids.map(kid => [kid.id, kid])).values());
      
      console.log('Final kids count:', uniqueKids.length);
      setKids(uniqueKids);
    } catch (err) {
      const error = err as { code?: string; message?: string };
      console.error('Error fetching kids:', error);
      console.log('Error details:', {
        code: error.code,
        message: error.message,
        parentId,
        email
      });
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider()
    
    // Force account selection even when one account is available
    provider.setCustomParameters({
      prompt: 'select_account'
    })

    try {
      const result = await signInWithPopup(auth, provider)
      const idToken = await result.user.getIdToken()
      console.log('Got ID token, creating session...')
      
      // Create session cookie
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
        credentials: 'include',
      })

      const data = await response.json()
      console.log('Session creation response:', data)

      if (response.ok) {
        // Wait a moment for the cookie to be set
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // If there's a redirect URL in the query params, go there
        const urlParams = new URLSearchParams(window.location.search)
        const redirect = urlParams.get('redirect')
        if (redirect) {
          router.push(redirect)
        } else {
          router.refresh()
        }
      } else {
        console.error('Session creation failed:', data)
        alert('Failed to create session. Please try again.')
      }
    } catch (error) {
      console.error('Error signing in with Google:', error)
      alert('Failed to sign in. Please try again.')
    }
  }

  const handleAddKid = () => {
    setShowAddKidForm(true)
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleTogglePublic = async (kidId: string, newPublicState: boolean) => {
    try {
      const kidRef = doc(db, 'kids', kidId)
      await updateDoc(kidRef, {
        public: newPublicState
      })
      // Refresh the list
      fetchKids(user.uid, user.email || '')
    } catch (error) {
      console.error('Error toggling public state:', error)
      alert('Failed to update settings. Please try again.')
    }
  }

  if (!user) {
    return (
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-6">Parent Dashboard</h1>
        <button
          onClick={handleLogin}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Sign in with Google
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Parent Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Logged in as: {user.displayName} ({user.email})
          </p>
        </div>
        <button
          onClick={handleAddKid}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
        >
          Add New Kid
        </button>
      </div>

      {kids.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-xl text-gray-600 mb-4">No kids added yet</p>
          <button
            onClick={handleAddKid}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
          >
            Add Your First Kid
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kids.map((kid: any) => (
            <Link 
              href={`/parent/kid/${kid.slug}`}  
              key={kid.id} 
              className="block p-6 bg-white rounded-lg border border-gray-200 shadow-md hover:bg-gray-50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{kid.name}</h2>
                  <p className="text-gray-600">Total: ${kid.total.toFixed(2)}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {kid.parentId === user.uid ? 'Owner' : 'Shared Access'}
                  </p>
                </div>
                <span className={`text-sm px-2 py-0.5 rounded ${
                  kid.public 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {kid.public ? 'Public' : 'Private'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showAddKidForm && (
        <AddKidForm
          userId={user.uid}
          userEmail={user.email}
          onClose={() => setShowAddKidForm(false)}
          onSuccess={() => fetchKids(user.uid, user.email || '')}
        />
      )}
    </div>
  )
}

