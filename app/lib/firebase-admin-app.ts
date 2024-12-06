import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App | undefined;

export function getAdminApp() {
  if (!adminApp) {
    try {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      console.log('Initializing Firebase Admin with:', {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKeyLength: privateKey?.length || 0
      });

      if (getApps().length === 0) {
        adminApp = initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
          }),
        });
      } else {
        adminApp = getApps()[0];
      }
    } catch (error) {
      console.error('Firebase Admin initialization error:', error);
      throw error;
    }
  }
  return adminApp;
}

export function getAdminAuth() {
  const app = getAdminApp();
  if (!app) {
    throw new Error('Firebase Admin app not initialized');
  }
  return getAuth(app);
}

export function getAdminFirestore() {
  const app = getAdminApp();
  if (!app) {
    throw new Error('Firebase Admin app not initialized');
  }
  return getFirestore(app);
} 