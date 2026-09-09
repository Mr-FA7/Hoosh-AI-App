/**
 * Hosted web → marketing only.
 * Local / desktop → signed-in app (or sign-in gate).
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import AuthGate from '../components/AuthGate';
import MarketingLanding from '../components/MarketingLanding';
import { isHostedWebApp } from '../runtimeEnv';

const AuthBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, initializing } = useAuth();

  if (isHostedWebApp()) {
    return <MarketingLanding />;
  }

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
