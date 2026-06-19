import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, XCircle, Info, RefreshCw } from 'lucide-react';
import { API_BASE } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';

export type ProblemItem = {
  resource: string;
  message: string;
  severity: number;
  startLineNumber: number;
  startColumn: number;
};

interface ProblemsPanelProps {
  onOpenLocation?: (path: string, line: number, column?: number) => void;
}

const ProblemsPanel: React.FC<ProblemsPanelProps> = ({ onOpenLocation }) => {
  const { t } = useI18n();
  const [markers, setMarkers] = useState<ProblemItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API_BASE}/v3/context/problems/list`);
      setMarkers(r.data?.markers || []);
    } catch {
      setMarkers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => { void refresh(); }, 4000);
    const onFocus = () => { void refresh(); };
    window.addEventListener('fa7-problems-updated', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('fa7-problems-updated', onFocus);
    };
  }, [refresh]);

  const iconFor = (sev: number) => {
    if (sev === 8) return <XCircle size={14} color="#ef4444" />;
    if (sev === 4) return <AlertTriangle size={14} color="#f59e0b" />;
    return <Info size={14} color="#60a5fa" />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a', color: '#e4e4e7' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #222' }}>
        <span style={{ fontWeight: 600, fontSize: '13px' }}>{t('problems.title')}</span>
        <button type="button" onClick={() => void refresh()} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }} aria-label="Refresh">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {markers.length === 0 && (
          <div style={{ color: '#666', fontSize: '12px', padding: '12px' }}>{t('problems.empty')}</div>
        )}
        {markers.map((m, i) => (
          <button
            key={`${m.resource}-${m.startLineNumber}-${i}`}
            type="button"
            onClick={() => onOpenLocation?.(m.resource, m.startLineNumber, m.startColumn)}
            style={{
              display: 'flex',
              gap: '8px',
              width: '100%',
              textAlign: 'left',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '8px',
              padding: '8px 10px',
              marginBottom: '6px',
              cursor: 'pointer',
              color: 'inherit'
            }}
          >
            <span style={{ marginTop: '2px' }}>{iconFor(m.severity)}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', color: '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.message}</div>
              <div style={{ fontSize: '11px', color: '#71717a', marginTop: '2px' }}>
                {m.resource}:{m.startLineNumber}:{m.startColumn}
              </div>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProblemsPanel;
