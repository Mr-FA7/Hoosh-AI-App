import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { History, RotateCcw, Trash2, Loader2, X } from 'lucide-react';
import { API_BASE } from '../../apiBase';
import { useI18n } from '../../i18n/LocaleContext';

interface Checkpoint {
  id: string;
  label?: string;
  createdAt?: string;
  files?: string[];
}

interface CheckpointPanelProps {
  open: boolean;
  onClose: () => void;
  onRestored?: () => void;
}

const CheckpointPanel: React.FC<CheckpointPanelProps> = ({ open, onClose, onRestored }) => {
  const { t } = useI18n();
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API_BASE}/v3/checkpoints`);
      setCheckpoints(r.data?.checkpoints || []);
    } catch {
      setCheckpoints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleRestore = async (id: string) => {
    if (!confirm(t('checkpoint.confirmRestore'))) return;
    setRestoring(id);
    try {
      await axios.post(`${API_BASE}/v3/checkpoints/restore`, { id });
      onRestored?.();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Restore failed';
      alert(msg);
    } finally {
      setRestoring(null);
    }
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '480px', maxHeight: '70vh', background: '#1e1e1e', borderRadius: '12px',
          border: '1px solid #333', display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #333',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={18} color="#3b82f6" />
            <span style={{ fontWeight: 600, color: '#fff' }}>{t('checkpoint.title')}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', padding: '20px' }}>
              <Loader2 size={16} className="animate-spin" /> {t('checkpoint.loading')}
            </div>
          )}
          {!loading && checkpoints.length === 0 && (
            <p style={{ color: '#666', fontSize: '13px', padding: '20px', textAlign: 'center' }}>
              {t('checkpoint.empty')}
            </p>
          )}
          {checkpoints.map((cp) => (
            <div key={cp.id} style={{
              padding: '12px 14px', marginBottom: '8px', background: '#252525',
              borderRadius: '8px', border: '1px solid #333'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#ddd' }}>
                    {cp.label || cp.id}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                    {cp.createdAt ? new Date(cp.createdAt).toLocaleString() : ''}
                    {cp.files?.length ? ` · ${cp.files.length} ${t('checkpoint.files')}` : ''}
                  </div>
                  {cp.files && cp.files.length > 0 && (
                    <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>
                      {cp.files.slice(0, 3).join(', ')}{cp.files.length > 3 ? '…' : ''}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleRestore(cp.id)}
                  disabled={restoring === cp.id}
                  style={{
                    background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                    color: '#93c5fd', padding: '6px 10px', borderRadius: '6px', fontSize: '11px',
                    cursor: restoring === cp.id ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  {restoring === cp.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                  {t('checkpoint.restore')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CheckpointPanel;
