import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { EXPECTED_FIREBASE_PROJECT_ID } from './constants'
import { firebaseConfigStatus } from './config'
import { AllowanceError } from './errors'

/**
 * Firestore client for the bot route. Initializes the existing admin app
 * without logging credential material. Refuses any project other than
 * allowance-25489. Callers must not log the thrown admin SDK error.
 */
export function getBotFirestore() {
  if (firebaseConfigStatus(process.env) !== 'ok') {
    throw new AllowanceError('not_configured', 503)
  }
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey || projectId !== EXPECTED_FIREBASE_PROJECT_ID) {
    throw new AllowanceError('not_configured', 503)
  }

  let app = getApps()[0]
  if (!app) {
    try {
      app = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      })
    } catch {
      app = getApps()[0]
    }
  }
  if (!app || (app.options.projectId && app.options.projectId !== EXPECTED_FIREBASE_PROJECT_ID)) {
    throw new AllowanceError('not_configured', 503)
  }
  return getFirestore(app)
}
