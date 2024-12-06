export const dynamic = 'force-dynamic'
export const revalidate = 0

import { cookies } from 'next/headers'
import { getAdminAuth, getAdminFirestore } from '@/app/lib/firebase-admin-app'
import { notFound, redirect } from 'next/navigation'
import KidTotal from '../components/KidTotal'
import TransactionsList from '../components/TransactionsList'

interface KidData {
  id: string;
  name: string;
  total: number;
  parentId: string;
  sharedWith: string[];
  public?: boolean;
  slug: string;
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
  const kidsSnapshot = await db.collection('kids')
    .where('slug', '==', slug)
    .get()
  
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
  const hasAccess = user && (
    kid.parentId === user.uid || 
    (Array.isArray(kid.sharedWith) && kid.sharedWith.includes(user.email))
  )

  if (!kid.public && !hasAccess) {
    redirect('/access-denied')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">{kid.name}&apos;s Dashboard</h1>
      <KidTotal kidId={kid.id} />
      <div className="mt-8">
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