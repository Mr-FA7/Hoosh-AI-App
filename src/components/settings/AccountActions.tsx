/**
 * Sign out and delete-account controls for the Settings → Account section.
 * Deleting requires the password because Firebase treats it as a sensitive
 * operation needing a recent login.
 */
import React, { useState } from 'react';
import { LogOut, Trash2, Loader2 } from 'lucide-react';
import { useAuth, authErrorKey } from '../../auth/AuthContext';
import { useI18n } from '../../i18n/LocaleContext';

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px',
  borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  border: '1px solid hsl(var(--border) / 0.5)', background: 'transparent',
  color: 'hsl(var(--text-secondary))'
};
const dangerBtn: React.CSSProperties = {
  ...btn, color: '#fca5a5', borderColor: 'rgba(239,68,68,.35)', background: 'rgba(239,68,68,.08)'
};
const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8,
  border: '1px solid #334155', background: 'rgba(0,0,0,.25)', color: '#e5e7eb',
  fontSize: 12, marginBottom: 8, outline: 'none'
};

const AccountActions: React.FC = () => {
  const { user, signOut, deleteAccount } = useAuth();
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const onDelete = async () => {
    setError(null);
    if (!password) { setError(t('auth.errMissingFields')); return; }
    setBusy(true);
    try {
      await deleteAccount(password);
      // Auth listener drops back to the sign-in screen automatically.
    } catch (err) {
      setError(t(authErrorKey(err)));
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        <button style={btn} onClick={() => void signOut()}>
          <LogOut size={13} /> {t('auth.signOut')}
        </button>
        {!confirming && (
          <button style={dangerBtn} onClick={() => { setConfirming(true); setError(null); }}>
            <Trash2 size={13} /> {t('auth.deleteAccount')}
          </button>
        )}
      </div>

      {confirming && (
        <div style={{
          border: '1px solid rgba(239,68,68,.3)', background: 'rgba(239,68,68,.06)',
          borderRadius: 10, padding: 13
        }}>
          <p style={{ fontSize: 12, color: '#fca5a5', margin: '0 0 9px', lineHeight: 1.6 }}>
            {t('auth.deleteWarning')}
          </p>
          <label style={{ fontSize: 11, color: 'hsl(var(--text-secondary))', display: 'block', marginBottom: 5 }}>
            {t('auth.confirmPasswordToDelete')}
          </label>
          <input
            style={input}
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <div style={{ fontSize: 11.5, color: '#fca5a5', marginBottom: 8 }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...dangerBtn, opacity: busy ? 0.6 : 1 }} onClick={onDelete} disabled={busy}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              {t('auth.confirmDelete')}
            </button>
            <button
              style={btn}
              disabled={busy}
              onClick={() => { setConfirming(false); setPassword(''); setError(null); }}
            >
              {t('auth.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountActions;
