import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserSessionPersistence,
} from 'firebase/auth';

import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/*
  Create separate Firebase app
*/
const parentApp =
  getApps().find((app) => app.name === 'parent-app') ||
  initializeApp(firebaseConfig, 'parent-app');

/*
  Create separate auth instance
*/
export const parentAuth = getAuth(parentApp);

/*
  IMPORTANT:
  Session persistence only for parent auth
*/
if (typeof window !== 'undefined') {
  setPersistence(parentAuth, browserSessionPersistence).catch(console.error);
}

export const parentDb = getFirestore(parentApp);