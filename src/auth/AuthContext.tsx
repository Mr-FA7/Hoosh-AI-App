/**
 * Account state for Hoosh: sign up, sign in, sign out, delete account.
 *
 * Deleting an account is a "sensitive" Firebase operation — it requires a
 * recent login, so we re-authenticate with the password before deleting.
 */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  type User
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export type AuthCtx = {
  user: User | null;
  /** True until the first auth-state callback resolves. */
  initializing: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

/** Map Firebase error codes to i18n keys so the UI never shows raw codes. */
export function authErrorKey(err: unknown): string {
  const code = String((err as { code?: string })?.code || '');
  switch (code) {
    case 'auth/email-already-in-use': return 'auth.errEmailInUse';
    case 'auth/invalid-email': return 'auth.errInvalidEmail';
    case 'auth/weak-password': return 'auth.errWeakPassword';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'auth.errBadCredentials';
    case 'auth/too-many-requests': return 'auth.errTooManyRequests';
    case 'auth/network-request-failed': return 'auth.errNetwork';
    case 'auth/requires-recent-login': return 'auth.errNeedsRecentLogin';
    case 'auth/operation-not-allowed': return 'auth.errProviderDisabled';
    default: return 'auth.errGeneric';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Safety net: if Firebase never reports a state (blocked storage, broken
    // network stack, restricted Electron context) the app must not sit on a
    // blank splash forever — fall through to the sign-in screen instead.
    const timeout = window.setTimeout(() => setInitializing(false), 8000);
    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        window.clearTimeout(timeout);
        setUser(u);
        setInitializing(false);
      },
      () => {
        window.clearTimeout(timeout);
        setInitializing(false);
      }
    );
    return () => {
      window.clearTimeout(timeout);
      unsub();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName && displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
      setUser({ ...cred.user } as User);
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    const current = auth.currentUser;
    if (!current || !current.email) throw Object.assign(new Error('no user'), { code: 'auth/user-not-found' });
    // Sensitive op: Firebase requires a recent login.
    const credential = EmailAuthProvider.credential(current.email, password);
    await reauthenticateWithCredential(current, credential);
    await deleteUser(current);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ user, initializing, signUp, signIn, signOut, deleteAccount, resetPassword }),
    [user, initializing, signUp, signIn, signOut, deleteAccount, resetPassword]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
