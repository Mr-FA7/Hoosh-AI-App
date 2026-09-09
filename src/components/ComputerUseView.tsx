import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { MonitorSmartphone } from 'lucide-react';
import { API_BASE } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';

const ComputerUseView: React.FC = () => {
  const { t } = useI18n();
  const [status, setStatus] = useState<any>(null);

  const refresh = useCallback(async () => {
    const r = await axios.get(`${API_BASE}/v3/negah/status`);
    setStatus(r.data);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div style={{ padding: 28, maxWidth: 640, margin: '0 auto', overflow: 'auto', height: '100%' }}>
      <h1 style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 20 }}>
        <MonitorSmartphone size={20} /> {t('computerUse.title')}
      </h1>
      <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>{t('computerUse.hint')}</p>
      <div style={{ padding: 14, borderRadius: 12, border: '1px solid hsl(var(--border) / 0.5)', fontSize: 13 }}>
        <div>Platform: {status?.platform || '—'}</div>
        <div>Supported: {status?.supported ? t('computerUse.yes') : t('computerUse.no')}</div>
        <div>Capability: {status?.computerUse ? 'on' : 'off'}</div>
      </div>
      <p style={{ fontSize: 12, color: 'hsl(var(--destructive))', marginTop: 16 }}>{t('computerUse.stopTip')}</p>
    </div>
  );
};

export default ComputerUseView;
