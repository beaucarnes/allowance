import { cookies } from 'next/headers'
import { getAdminAuth } from '@/app/lib/firebase-admin-app'
import { getFirestore } from 'firebase-admin/firestore'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface KidData {
  id: string;
  name: string;
  total: number;
  slug: string;
  parentId: string;
  sharedWith: string[];
}

async function verifySession() {
  const cookieStore = cookies()
  const session = cookieStore.get('session')
  
  if (!session) {
    return null
  }

  try {
    const auth = getAdminAuth()
    const decodedClaims = await auth.verifySessionCookie(session.value, true)
    return {
      uid: decodedClaims.uid,
      email: decodedClaims.email || decodedClaims.firebase?.identities?.['google.com']?.[0],
    }
  } catch (error) {
    console.error('Session verification error:', error)
    return null
  }
}

async function getUserKids(userId: string, email: string): Promise<KidData[]> {
  const db = getFirestore()
  
  // Get kids where user is the parent
  const parentKidsSnapshot = await db.collection('kids')
    .where('parentId', '==', userId)
    .get()

  // Get kids shared with the user
  const sharedKidsSnapshot = await db.collection('kids')
    .where('sharedWith', 'array-contains', email)
    .get()

  // Combine and deduplicate results
  const allKids = [
    ...parentKidsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    ...sharedKidsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  ]

  return Array.from(new Map(allKids.map(kid => [kid.id, kid])).values()) as KidData[]
}

export default async function KidsPage() {
  const user = await verifySession()
  if (!user) {
    redirect('/parent')
  }

  const kids = await getUserKids(user.uid, user.email)

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Kids&apos; Dashboards</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kids.map((kid) => (
          <Link 
            href={`/kids/${kid.slug}`}
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
            </div>
          </Link>
        ))}

        {kids.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-lg shadow">
            <p className="text-xl text-gray-600 mb-4">No kids found</p>
            <Link 
              href="/parent"
              className="text-blue-500 hover:text-blue-700"
            >
              Go to Parent Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

