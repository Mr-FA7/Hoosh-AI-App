/**
 * Sidebar account popover — Cursor-style foot menu, Hoosh economics:
 * free / local-first. No Upgrade CTA, no token metering.
 */
import React, { useEffect, useRef, useState } from 'react';
import { User, Settings, Monitor, HelpCircle, LogOut, Languages, ChevronRight } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/LocaleContext';
import type { UiLocale } from '../i18n/messages';
import type { ViewMode } from '../shell/viewCatalog';
import './AccountMenu.css';

type Props = {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
};

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const n = (name || '').trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  const e = (email || '').trim();
  return e ? e.slice(0, 2).toUpperCase() : '?';
}

const AccountMenu: React.FC<Props> = ({ viewMode, setViewMode }) => {
  const { user, signOut } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setLangOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const displayName = user?.displayName?.trim() || user?.email?.split('@')[0] || t('account.guest');
  const email = user?.email || '';
  const label = initials(user?.displayName, user?.email);
  const localeLabel = locale === 'fa' ? 'فارسی' : 'English';

  const go = (mode: ViewMode) => {
    setViewMode(mode);
    setOpen(false);
    setLangOpen(false);
  };

  const pickLocale = (l: UiLocale) => {
    setLocale(l);
    setLangOpen(false);
  };

  const logout = async () => {
    setOpen(false);
    try {
      await signOut();
    } catch {
      /* AuthGate will handle signed-out state */
    }
  };

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className={`account-menu-trigger ${open || viewMode === 'settings' ? 'active' : ''}`}
        onClick={() => {
          setOpen((v) => !v);
          setLangOpen(false);
        }}
        title={displayName}
        aria-label={t('account.menu')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="account-avatar" aria-hidden>
          {label}
        </span>
      </button>

      {open && (
        <div className="account-popover" role="menu" data-side="top">
          <div className="account-popover-header">
            <div className="account-popover-name">{displayName}</div>
            {email ? <div className="account-popover-email">{email}</div> : null}
            <div className="account-plan-badge" title={t('account.planHint')}>
              {t('account.planLocal')}
            </div>
          </div>

          <button type="button" role="menuitem" className="account-item" onClick={() => go('settings')}>
            <User size={15} />
            <span>{t('account.profile')}</span>
          </button>
          <button type="button" role="menuitem" className="account-item" onClick={() => go('settings')}>
            <Settings size={15} />
            <span>{t('account.settings')}</span>
          </button>
          <button type="button" role="menuitem" className="account-item" onClick={() => go('settings')}>
            <Monitor size={15} />
            <span>{t('settings.appearance')}</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="account-item account-item-split"
            onClick={() => setLangOpen((v) => !v)}
            aria-expanded={langOpen}
          >
            <Languages size={15} />
            <span>{t('lang.section')}</span>
            <span className="account-item-meta">{localeLabel}</span>
            <ChevronRight size={14} className={langOpen ? 'rotated' : ''} />
          </button>
          {langOpen && (
            <div className="account-submenu" role="group">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={locale === 'en'}
                className={`account-item ${locale === 'en' ? 'selected' : ''}`}
                onClick={() => pickLocale('en')}
              >
                English
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={locale === 'fa'}
                className={`account-item ${locale === 'fa' ? 'selected' : ''}`}
                onClick={() => pickLocale('fa')}
              >
                فارسی
              </button>
            </div>
          )}

          <button type="button" role="menuitem" className="account-item" onClick={() => go('settings')}>
            <HelpCircle size={15} />
            <span>{t('account.help')}</span>
          </button>

          <div className="account-divider" role="separator" />

          <button type="button" role="menuitem" className="account-item danger" onClick={logout}>
            <LogOut size={15} />
            <span>{t('auth.signOut')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
