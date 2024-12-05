export const dynamic = 'force-dynamic'
export const revalidate = 0

import { cookies } from 'next/headers'
import { getAdminAuth } from '@/app/lib/firebase-admin-app'
import { getFirestore } from 'firebase-admin/firestore'
import { notFound, redirect } from 'next/navigation'
import KidTotal from '../../components/KidTotal'
import TransactionsList from '../../components/TransactionsList'

interface KidData {
  id: string;
  name: string;
  total: number;
  parentId: string;
  sharedWith: string[];
  public?: boolean;
  slug: string;
}

interface Transaction {
  id: string;
  amount: number;
  description: string;
  date: Date;
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

async function getKidDataBySlug(slug: string): Promise<KidData | null> {
  const db = getFirestore()
  const kidsSnapshot = await db.collection('kids')
    .where('slug', '==', slug)
    .get()
  
  if (kidsSnapshot.empty) {
    return null
  }

  const kid = kidsSnapshot.docs[0]
  return { id: kid.id, ...kid.data() } as KidData
}

async function getTransactions(kidId: string) {
  const db = getFirestore()
  const transactionsSnapshot = await db.collection('kids')
    .doc(kidId)
    .collection('transactions')
    .orderBy('date', 'desc')
    .limit(10)
    .get()

  return transactionsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    date: doc.data().date.toDate()
  })) as Transaction[]
}

export default async function KidPage({ params }: { params: { slug: string } }) {
  // First verify session
  const user = await verifySession()
  
  // Get kid data
  const kid = await getKidDataBySlug(params.slug)
  if (!kid) {
    notFound()
  }

  // If kid is not public and user is not authenticated, redirect to login
  if (!kid.public && !user) {
    redirect('/parent?redirect=/kids/' + params.slug)
  }

  // If kid is not public and user doesn't have access, redirect
  if (!kid.public && user) {
    const hasAccess = kid.parentId === user.uid || 
                     (Array.isArray(kid.sharedWith) && kid.sharedWith.includes(user.email))
    if (!hasAccess) {
      redirect('/access-denied')
    }
  }

  // Get transactions for the kid
  const transactions = await getTransactions(kid.id)

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">{kid.name}'s Dashboard</h1>
      <KidTotal kidId={kid.id} />
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-2xl font-bold mb-4">Transaction History</h2>
        <TransactionsList 
          kidId={kid.id} 
          showActions={false} 
          isPublic={true}
          initialTransactions={transactions}
        />
      </div>
    </div>
  )
} 