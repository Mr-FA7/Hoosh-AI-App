import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Wrench } from 'lucide-react';
import { API_BASE } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';

const ToolsView: React.FC = () => {
  const { t } = useI18n();
  const [origins, setOrigins] = useState<Record<string, { count: number; items: any[] }>>({});

  const refresh = useCallback(async () => {
    const r = await axios.get(`${API_BASE}/v3/tools/registry`);
    setOrigins(r.data?.origins || {});
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div style={{ padding: 28, maxWidth: 800, margin: '0 auto', overflow: 'auto', height: '100%' }}>
      <h1 style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 20 }}>
        <Wrench size={20} /> {t('tools.title')}
      </h1>
      <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>{t('tools.hint')}</p>
      {(['native', 'mcp', 'skill', 'extension'] as const).map((key) => (
        <div key={key} style={{ marginBottom: 16, padding: 14, borderRadius: 12, border: '1px solid hsl(var(--border) / 0.5)' }}>
          <strong>{t(`tools.origin.${key}`)}</strong>
          <span style={{ marginLeft: 8, fontSize: 12, color: 'hsl(var(--text-secondary))' }}>
            {origins[key]?.count ?? 0}
          </span>
          <div style={{ fontSize: 12, marginTop: 8, color: 'hsl(var(--text-secondary))' }}>
            {(origins[key]?.items || []).slice(0, 12).map((it, i) => (
              <div key={i}>{it?.name || it?.id || JSON.stringify(it).slice(0, 80)}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ToolsView;
