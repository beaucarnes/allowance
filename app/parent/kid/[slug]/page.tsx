import { cookies } from 'next/headers'
import { getAdminAuth } from '@/app/lib/firebase-admin-app'
import { getFirestore } from 'firebase-admin/firestore'
import { notFound, redirect } from 'next/navigation'
import TransactionsList from '../../../components/TransactionsList'
import AddTransaction from '../../../components/AddTransaction'
import SubAccountsManager from '../../../components/SubAccountsManager'
import ParentBankTools from '../../../components/ParentBankTools'
import SpendingAnalytics from '../../../components/SpendingAnalytics'
import Link from 'next/link'

interface KidData {
  id: string
  name: string
  total: number
  parentId: string
  sharedWith: string[]
  public?: boolean
  slug: string
  weeklyAllowance?: number
  allowanceDay?: string
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
  const kidsSnapshot = await db.collection('kids').where('slug', '==', slug).get()

  if (kidsSnapshot.empty) {
    return null
  }

  const kid = kidsSnapshot.docs[0]
  return { id: kid.id, ...kid.data() } as KidData
}

export default async function KidPage({ params }: { params: { slug: string } }) {
  const user = await verifySession()
  if (!user) {
    redirect('/parent')
  }

  const kid = await getKidDataBySlug(params.slug)
  if (!kid) {
    notFound()
  }

  const hasAccess =
    kid.parentId === user.uid ||
    (Array.isArray(kid.sharedWith) && kid.sharedWith.includes(user.email))

  if (!hasAccess) {
    redirect('/access-denied')
  }

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/parent" className="hover:text-blue-600 font-medium">
              ← Parent Dashboard
            </Link>
            <span>/</span>
            <span>{kid.name}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900">{kid.name}&apos;s Bank Account</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={`/${kid.slug}`}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-4 py-2 rounded-xl text-sm border border-indigo-200 transition-colors"
          >
            👁 View Kid Dashboard (/{kid.slug})
          </Link>
          {kid.parentId === user.uid && (
            <Link
              href={`/parent/kid/${kid.slug}/settings`}
              className="bg-gray-800 hover:bg-gray-900 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
            >
              ⚙ Settings
            </Link>
          )}
        </div>
      </div>

      {/* Sub-Accounts, Checking Balance & Savings Goals Manager */}
      <SubAccountsManager
        kidId={kid.id}
        kidName={kid.name}
        weeklyAllowance={kid.weeklyAllowance || 0}
      />

      {/* Parent Bank Tools: 1-Click Weekly Allowance, Parent-Paid Interest & Chores/Bounties */}
      <ParentBankTools
        kidId={kid.id}
        kidName={kid.name}
        weeklyAllowance={kid.weeklyAllowance || 0}
        allowanceDay={kid.allowanceDay || 'Sunday'}
      />

      {/* Add Ledger Transaction */}
      <div>
        <AddTransaction kidId={kid.id} />
      </div>

      {/* 30-Day Analytics & CSV Export */}
      <SpendingAnalytics kidId={kid.id} kidName={kid.name} />

      {/* Full Transaction History */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Ledger Transaction History</h2>
        <TransactionsList kidId={kid.id} showActions={true} initialTransactions={[]} />
      </div>
    </div>
  )
}
