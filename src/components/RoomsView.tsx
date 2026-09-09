import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Users } from 'lucide-react';
import { API_BASE } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';

const MODES = ['sequential', 'parallel', 'debate', 'review', 'supervisor', 'swarm'] as const;

const RoomsView: React.FC = () => {
  const { t } = useI18n();
  const [rooms, setRooms] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<string>('sequential');
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState('');

  const refresh = useCallback(async () => {
    const r = await axios.get(`${API_BASE}/v3/rooms`);
    setRooms(r.data?.rooms || []);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const loadMessages = async (id: string) => {
    setSelected(id);
    const r = await axios.get(`${API_BASE}/v3/rooms/${id}/messages`);
    setMessages(r.data?.messages || []);
  };

  const create = async () => {
    if (!name.trim()) return;
    await axios.post(`${API_BASE}/v3/rooms`, { name: name.trim(), mode });
    setName('');
    await refresh();
  };

  const postMsg = async () => {
    if (!selected || !body.trim()) return;
    await axios.post(`${API_BASE}/v3/rooms/${selected}/messages`, { kind: 'status', body: body.trim() });
    setBody('');
    await loadMessages(selected);
  };

  return (
    <div style={{ padding: 28, maxWidth: 860, margin: '0 auto', overflow: 'auto', height: '100%' }}>
      <h1 style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 20 }}>
        <Users size={20} /> {t('rooms.title')}
      </h1>
      <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>{t('rooms.hint')}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('rooms.name')}
          style={{ flex: 1, minWidth: 160, padding: 10, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'transparent', color: 'hsl(var(--text-primary))' }} />
        <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ padding: 8, borderRadius: 8, background: 'transparent', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border))' }}>
          {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button type="button" onClick={() => void create()} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'hsl(var(--accent))', color: '#fff' }}>
          {t('rooms.create')}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          {rooms.map((r) => (
            <button key={r.id} type="button" onClick={() => void loadMessages(r.id)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: 12, marginBottom: 8, borderRadius: 10, border: selected === r.id ? '1px solid hsl(var(--accent))' : '1px solid hsl(var(--border) / 0.5)', background: 'transparent', color: 'hsl(var(--text-primary))', cursor: 'pointer' }}>
              <strong>{r.name}</strong>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{r.mode}</div>
            </button>
          ))}
        </div>
        <div>
          {selected ? (
            <>
              {messages.map((m) => (
                <div key={m.id} style={{ fontSize: 12, marginBottom: 8, padding: 8, borderRadius: 8, border: '1px solid hsl(var(--border) / 0.4)' }}>
                  <div style={{ color: 'hsl(var(--text-secondary))' }}>{m.kind} · {m.at}</div>
                  <div>{m.body}</div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('rooms.message')}
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'transparent', color: 'hsl(var(--text-primary))' }} />
                <button type="button" onClick={() => void postMsg()}>{t('rooms.send')}</button>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{t('rooms.select')}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomsView;
