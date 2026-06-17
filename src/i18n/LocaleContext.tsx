import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { UiLocale } from './messages';
import { LOCALE_STORAGE_KEY, translate } from './messages';

/** Stored preference and first-run default — English unless user picks فارسی in settings. */
export const DEFAULT_UI_LOCALE: UiLocale = 'en';

type Ctx = {
  locale: UiLocale;
  setLocale: (l: UiLocale) => void;
  t: (key: string) => string;
};

const LocaleContext = createContext<Ctx | null>(null);

function readStoredLocale(): UiLocale {
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (v === 'fa' || v === 'en') return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_UI_LOCALE;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(() => readStoredLocale());

  const setLocale = useCallback((l: UiLocale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'fa' ? 'fa-IR' : 'en';
    /* Keep layout LTR so Monaco, terminals, and code stay usable; Persian still renders with fa-IR shaping. */
  }, [locale]);

  const t = useCallback((key: string) => translate(locale, key), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useI18n must be used within LocaleProvider');
  return ctx;
}
