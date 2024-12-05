import { cookies } from 'next/headers'
import { getAdminAuth } from '@/app/lib/firebase-admin-app'
import { getFirestore } from 'firebase-admin/firestore'
import { notFound, redirect } from 'next/navigation'
import dynamic from 'next/dynamic'

type KidData = {
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

// Use dynamic import with no SSR to prevent hydration errors
const SettingsPage = dynamic(() => import('./SettingsPage'), { 
  ssr: false,
  loading: () => <div>Loading...</div>
})

export default async function Page({ params }: { params: { slug: string } }) {
  const user = await verifySession()
  if (!user) {
    redirect('/parent')
  }

  const kid = await getKidDataBySlug(params.slug)
  if (!kid) {
    notFound()
  }

  if (kid.parentId !== user.uid) {
    redirect('/access-denied')
  }

  return <SettingsPage kid={kid} />
} 