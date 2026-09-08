/**
 * Renders the app only when signed in; otherwise the sign in / sign up screen.
 * Shows a neutral splash while the first auth state resolves so the sign-in
 * form doesn't flash for users who are already signed in.
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import AuthGate from '../components/AuthGate';

const AuthBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0b1120', color: '#64748b'
      }}>
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (!user) return <AuthGate />;
  return <>{children}</>;
};

export default AuthBoundary;
