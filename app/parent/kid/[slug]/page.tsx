import { cookies } from 'next/headers'
import { getAdminAuth } from '@/app/lib/firebase-admin-app'
import { getFirestore } from 'firebase-admin/firestore'
import { notFound, redirect } from 'next/navigation'
import TransactionsList from '../../../components/TransactionsList'
import KidTotal from '../../../components/KidTotal'
import AddTransaction from '../../../components/AddTransaction'
import Link from 'next/link'

interface KidData {
  id: string;
  name: string;
  total: number;
  parentId: string;
  sharedWith: string[];
  public?: boolean;
  slug: string;
  weeklyAllowance?: number;
  allowanceDay?: string;
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

  return {
    transactions: transactionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date.toDate()
    })) as Transaction[]
  }
}

export default async function KidManagePage({ params }: { params: { slug: string } }) {
  const user = await verifySession()
  if (!user) {
    redirect('/parent')
  }

  const kid = await getKidDataBySlug(params.slug)
  if (!kid) {
    notFound()
  }

  const hasAccess = kid.parentId === user.uid || 
                   (Array.isArray(kid.sharedWith) && kid.sharedWith.includes(user.email))

  if (!hasAccess) {
    redirect('/access-denied')
  }

  const transactions = await getTransactions(kid.id)

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <h1 className="text-3xl font-bold">Manage {kid.name}'s Transactions</h1>
        {kid.parentId === user.uid && (
          <Link
            href={`/parent/kid/${kid.slug}/settings`}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            Settings
          </Link>
        )}
      </div>

      <KidTotal kidId={kid.id} />

      {(kid.weeklyAllowance || 0) > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-blue-600">
            Weekly Allowance: ${(kid.weeklyAllowance || 0).toFixed(2)} on {kid.allowanceDay || 'Sunday'}
          </p>
        </div>
      )}

      <AddTransaction kidId={kid.id} />

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-2xl font-bold mb-4">Transaction History</h2>
        <TransactionsList 
          kidId={kid.id} 
          showActions={true} 
          initialTransactions={transactions.transactions} 
        />
      </div>
    </div>
  )
}