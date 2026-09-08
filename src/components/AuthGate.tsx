/**
 * Sign in / sign up screen. Rendered instead of the app when signed out.
 */
import React, { useState } from 'react';
import { LogIn, UserPlus, Loader2, Mail, KeyRound, User as UserIcon } from 'lucide-react';
import { useAuth, authErrorKey } from '../auth/AuthContext';
import { useI18n } from '../i18n/LocaleContext';

const wrap: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#0b1120', padding: 24
};
const card: React.CSSProperties = {
  width: '100%', maxWidth: 380, background: '#111827', border: '1px solid #1f2937',
  borderRadius: 14, padding: 26, boxShadow: '0 18px 50px rgba(0,0,0,.45)'
};
const field: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9,
  border: '1px solid #334155', background: '#0b1120', color: '#e5e7eb',
  fontSize: 13, marginBottom: 10, outline: 'none'
};
const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '11px 16px', borderRadius: 10, border: 'none',
  background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 13,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
};
const linkBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#60a5fa',
  fontSize: 12, cursor: 'pointer', padding: 4
};

const AuthGate: React.FC = () => {
  const { signIn, signUp, resetPassword } = useAuth();
  const { t } = useI18n();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) { setError(t('auth.errMissingFields')); return; }
    if (mode === 'signup' && password.length < 6) { setError(t('auth.errWeakPassword')); return; }
    setBusy(true);
    try {
      if (mode === 'signup') await signUp(email, password, displayName);
      else await signIn(email, password);
      // On success the auth listener swaps this screen out.
    } catch (err) {
      setError(t(authErrorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  const onForgot = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim()) { setError(t('auth.errEnterEmailFirst')); return; }
    try {
      await resetPassword(email);
      setNotice(t('auth.resetSent'));
    } catch (err) {
      setError(t(authErrorKey(err)));
    }
  };

  return (
    <div style={wrap}>
      <form style={card} onSubmit={submit}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: '#f8fafc' }}>Hoosh AI</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 5 }}>
            {mode === 'signin' ? t('auth.signInSubtitle') : t('auth.signUpSubtitle')}
          </div>
        </div>

        {mode === 'signup' && (
          <label style={{ display: 'block' }}>
            <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <UserIcon size={12} /> {t('auth.name')}
            </span>
            <input style={field} value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name" placeholder={t('auth.namePlaceholder')} />
          </label>
        )}

        <label style={{ display: 'block' }}>
          <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <Mail size={12} /> {t('auth.email')}
          </span>
          <input style={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="email" required placeholder="you@example.com" />
        </label>

        <label style={{ display: 'block' }}>
          <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <KeyRound size={12} /> {t('auth.password')}
          </span>
          <input style={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required
            placeholder={mode === 'signup' ? t('auth.passwordHint') : '••••••••'} />
        </label>

        {error && (
          <div style={{ fontSize: 11.5, color: '#fca5a5', background: 'rgba(239,68,68,.1)',
            border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
            {error}
          </div>
        )}
        {notice && (
          <div style={{ fontSize: 11.5, color: '#86efac', background: 'rgba(34,197,94,.1)',
            border: '1px solid rgba(34,197,94,.3)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
            {notice}
          </div>
        )}

        <button type="submit" style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }} disabled={busy}>
          {busy ? <Loader2 size={15} className="animate-spin" />
            : mode === 'signin' ? <LogIn size={15} /> : <UserPlus size={15} />}
          {mode === 'signin' ? t('auth.signIn') : t('auth.signUp')}
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <button type="button" style={linkBtn}
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setNotice(null); }}>
            {mode === 'signin' ? t('auth.needAccount') : t('auth.haveAccount')}
          </button>
          {mode === 'signin' && (
            <button type="button" style={linkBtn} onClick={onForgot}>{t('auth.forgot')}</button>
          )}
        </div>
      </form>
    </div>
  );
};

export default AuthGate;
