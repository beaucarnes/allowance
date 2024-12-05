import { getApps, initializeApp, cert, getApp, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App;

export function getAdminApp() {
  if (!adminApp) {
    try {
      adminApp = getApps().length === 0 
        ? initializeApp({
            credential: cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
          })
        : getApp();
    } catch (error) {
      console.error('Firebase admin initialization error:', error);
      throw error;
    }
  }
  return adminApp;
}

export function getAdminAuth() {
  const app = getAdminApp();
  return getAuth(app);
} 