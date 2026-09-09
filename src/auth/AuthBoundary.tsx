/**
 * Hosted web → marketing only.
 * Local / desktop → signed-in app (or sign-in gate).
 */
import React, { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import AuthGate from '../components/AuthGate';
import { isHostedWebApp } from '../runtimeEnv';

const MarketingApp = lazy(() => import('../marketing/MarketingApp'));

const AuthBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, initializing } = useAuth();

  if (isHostedWebApp()) {
    return (
      <Suspense
        fallback={
          <div
            style={{
              minHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#071018',
              color: '#8b9bb0',
            }}
          >
            <Loader2 size={22} className="animate-spin" aria-label="Loading" />
          </div>
        }
      >
        <MarketingApp />
      </Suspense>
    );
  }

  if (initializing) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b1120',
          color: '#64748b',
        }}
      >
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (!user) return <AuthGate />;
  return <>{children}</>;
};

export default AuthBoundary;
