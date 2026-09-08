/**
 * Firebase app + auth initialisation.
 *
 * These web config values are public by design — they identify the Firebase
 * project, they do not grant access. Access is controlled by Firebase
 * Authentication and Security Rules.
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCg0TUEZIs0rblUUIG6-FTqCBP-qklTx2M',
  authDomain: 'pay-rah.firebaseapp.com',
  projectId: 'pay-rah',
  storageBucket: 'pay-rah.firebasestorage.app',
  messagingSenderId: '266755802770',
  appId: '1:266755802770:web:702c7a7e42349c2748c84b',
  measurementId: 'G-6T11PGSJ26'
};

export const firebaseApp: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(firebaseApp);
