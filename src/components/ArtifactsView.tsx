import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { FileBox } from 'lucide-react';
import { API_BASE } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';

const ArtifactsView: React.FC = () => {
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>([]);

  const refresh = useCallback(async () => {
    const r = await axios.get(`${API_BASE}/v3/artifacts`);
    setItems(r.data?.artifacts || []);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div style={{ padding: 28, maxWidth: 720, margin: '0 auto', overflow: 'auto', height: '100%' }}>
      <h1 style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 20 }}>
        <FileBox size={20} /> {t('artifacts.title')}
      </h1>
      <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>{t('artifacts.hint')}</p>
      {items.map((a) => (
        <div key={a.id} style={{ padding: 12, marginBottom: 8, borderRadius: 10, border: '1px solid hsl(var(--border) / 0.5)' }}>
          <strong>{a.title}</strong>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{a.kind} · {a.path || '—'} · {a.created_at}</div>
        </div>
      ))}
      {!items.length && <p style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{t('artifacts.empty')}</p>}
    </div>
  );
};

export default ArtifactsView;
