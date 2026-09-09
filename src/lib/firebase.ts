/**
 * Firebase app + auth initialisation.
 *
 * Web config values identify the Firebase project. They are not service-account
 * credentials. Access is controlled by Firebase Authentication and Security Rules.
 * Override via VITE_FIREBASE_* environment variables (see `.env.example`).
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCg0TUEZIs0rblUUIG6-FTqCBP-qklTx2M',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'pay-rah.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'pay-rah',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'pay-rah.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '266755802770',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:266755802770:web:702c7a7e42349c2748c84b',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-6T11PGSJ26',
};

export const firebaseApp: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(firebaseApp);
