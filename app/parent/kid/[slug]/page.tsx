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

async function getAllKidsForParent(uid: string, email?: string): Promise<KidData[]> {
  try {
    const db = getFirestore()
    const ownedSnap = await db.collection('kids').where('parentId', '==', uid).get()
    const map = new Map<string, KidData>()
    ownedSnap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as KidData))

    if (email) {
      const sharedSnap = await db
        .collection('kids')
        .where('sharedWith', 'array-contains', email)
        .get()
      sharedSnap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as KidData))
    }

    return Array.from(map.values())
  } catch {
    return []
  }
}

export default async function KidPage({ params }: { params: { slug: string } }) {
  const user = await verifySession()
  if (!user) {
    redirect('/parent')
  }

  const [kid, siblings] = await Promise.all([
    getKidDataBySlug(params.slug),
    getAllKidsForParent(user.uid, user.email),
  ])

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
    <div className="space-y-6">
      {/* Compact Header + Sibling Quick-Switcher */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Link href="/parent" className="hover:text-blue-600 font-semibold">
                ← All Kids
              </Link>
              <span>/</span>
              <span className="font-semibold text-gray-700">{kid.name}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {kid.name}&apos;s Bank Account
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/${kid.slug}`}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-3.5 py-2 rounded-xl text-xs sm:text-sm border border-indigo-200 transition-colors"
            >
              👁 Kid View (/{kid.slug})
            </Link>
            {kid.parentId === user.uid && (
              <Link
                href={`/parent/kid/${kid.slug}/settings`}
                className="bg-gray-800 hover:bg-gray-900 text-white font-semibold px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-colors"
              >
                ⚙ Settings
              </Link>
            )}
          </div>
        </div>

        {/* Sibling Switcher + Section Jump Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 text-xs">
          {siblings.length > 1 ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-gray-400 font-semibold mr-1">Switch Kid:</span>
              {siblings.map((sib) => {
                const active = sib.slug === kid.slug
                return (
                  <Link
                    key={sib.id}
                    href={`/parent/kid/${sib.slug}`}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {sib.name} (${Number(sib.total || 0).toFixed(2)})
                  </Link>
                )
              })}
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 flex-wrap text-gray-600 font-semibold">
            <a href="#subaccounts" className="px-2.5 py-1 rounded-lg hover:bg-gray-100">
              🐷 Sub-Accounts
            </a>
            <a href="#history" className="px-2.5 py-1 rounded-lg hover:bg-gray-100">
              📜 History
            </a>
            <a href="#tools" className="px-2.5 py-1 rounded-lg hover:bg-gray-100">
              💵 Allowance &amp; Chores
            </a>
            <a href="#analytics" className="px-2.5 py-1 rounded-lg hover:bg-gray-100">
              📊 Analytics
            </a>
          </div>
        </div>
      </div>

      {/* #1 MOST USED: Quick Add Ledger Transaction right at the top! */}
      <AddTransaction
        kidId={kid.id}
        kidName={kid.name}
        weeklyAllowance={kid.weeklyAllowance || 0}
      />

      {/* #2: Sub-Accounts, Checking Balance & Savings Goals Manager */}
      <div id="subaccounts" className="scroll-mt-6">
        <SubAccountsManager
          kidId={kid.id}
          kidName={kid.name}
          weeklyAllowance={kid.weeklyAllowance || 0}
        />
      </div>

      {/* #3: Ledger Transaction History (right below so parents immediately see recent entries) */}
      <div
        id="history"
        className="scroll-mt-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-200"
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-4">📜 Ledger Transaction History</h2>
        <TransactionsList kidId={kid.id} showActions={true} initialTransactions={[]} />
      </div>

      {/* #4: Parent Bank Tools: 1-Click Weekly Allowance, Parent-Paid Interest & Chores/Bounties */}
      <div id="tools" className="scroll-mt-6">
        <ParentBankTools
          kidId={kid.id}
          kidName={kid.name}
          weeklyAllowance={kid.weeklyAllowance || 0}
          allowanceDay={kid.allowanceDay || 'Sunday'}
        />
      </div>

      {/* #5: 30-Day Analytics & CSV Export */}
      <div id="analytics" className="scroll-mt-6">
        <SpendingAnalytics kidId={kid.id} kidName={kid.name} />
      </div>
    </div>
  )
}
