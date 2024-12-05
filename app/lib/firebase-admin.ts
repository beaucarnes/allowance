import { getApps, cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

export const initAdmin = async () => {
  const apps = getApps()
  
  if (!apps.length) {
    try {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      })
      console.log('Firebase Admin initialized successfully')
    } catch (error) {
      console.error('Firebase admin initialization error:', error)
    }
  }
  
  return { getAuth }
} 