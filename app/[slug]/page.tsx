export const dynamic = 'force-dynamic'
export const revalidate = 0

import { cookies } from 'next/headers'
import { getAdminAuth, getAdminFirestore } from '@/app/lib/firebase-admin-app'
import { notFound, redirect } from 'next/navigation'
import TransactionsList from '../components/TransactionsList'
import KidsSubAccountsView from '../components/KidsSubAccountsView'
import KidsBankTools from '../components/KidsBankTools'
import Link from 'next/link'

interface KidData {
  id: string
  name: string
  total: number
  parentId: string
  sharedWith: string[]
  public?: boolean
  slug: string
  allowKidSubaccountTransfers?: boolean
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
  const db = getAdminFirestore()
  const kidsSnapshot = await db.collection('kids').where('slug', '==', slug).get()

  if (kidsSnapshot.empty) {
    return null
  }

  const kid = kidsSnapshot.docs[0]
  return { id: kid.id, ...kid.data() } as KidData
}

export default async function KidPage({ params }: { params: { slug: string } }) {
  const kid = await getKidDataBySlug(params.slug)
  if (!kid) {
    notFound()
  }

  const user = await verifySession()
  const hasAccess =
    user &&
    (kid.parentId === user.uid ||
      (Array.isArray(kid.sharedWith) && kid.sharedWith.includes(user.email)))

  if (!kid.public && !hasAccess) {
    redirect('/access-denied')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full mb-1">
            🌟 Personal Kid Bank Dashboard
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900">{kid.name}&apos;s Dashboard</h1>
        </div>
        {hasAccess && (
          <Link
            href={`/parent/kid/${kid.slug}`}
            className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-4 py-2 rounded-xl text-xs self-start sm:self-auto"
          >
            Manage in Parent Mode →
          </Link>
        )}
      </div>

      {/* Balances, Checking & Sub-Accounts / Savings Goals */}
      <KidsSubAccountsView
        kidId={kid.id}
        kidName={kid.name}
        allowTransfers={kid.allowKidSubaccountTransfers !== false}
      />

      {/* Chores & Bounties + Compound Interest Time Machine */}
      <KidsBankTools kidId={kid.id} kidName={kid.name} />

      {/* Transaction History */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">📜 Transaction History</h2>
        <TransactionsList
          kidId={kid.id}
          showActions={false}
          isPublic={true}
          initialTransactions={[]}
        />
      </div>
    </div>
  )
}
