import React from 'react';
import { useI18n } from '../i18n/LocaleContext';
import type { UiLocale } from '../i18n/messages';
import { LOCALE_LABEL } from '../i18n/messages';

type Props = {
  /** Tighter layout for welcome screen header */
  compact?: boolean;
};

export const LanguageSwitcher: React.FC<Props> = ({ compact }) => {
  const { locale, setLocale } = useI18n();
  const choices: UiLocale[] = ['en', 'fa'];

  return (
    <div
      role="group"
      aria-label={LOCALE_LABEL[locale]}
      style={{
        display: 'inline-flex',
        gap: compact ? 6 : 8,
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {choices.map((l) => {
        const active = locale === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            style={{
              padding: compact ? '5px 12px' : '8px 16px',
              borderRadius: '10px',
              fontSize: compact ? '11px' : '13px',
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
              border: active ? '1px solid hsl(var(--accent))' : '1px solid hsl(var(--border) / 0.45)',
              background: active ? 'hsl(var(--accent) / 0.18)' : 'transparent',
              color: active ? 'hsl(var(--accent))' : 'hsl(var(--text-secondary))',
              transition: 'all 0.15s ease'
            }}
          >
            {LOCALE_LABEL[l]}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSwitcher;
