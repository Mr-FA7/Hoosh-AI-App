import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';

interface InlineChatProps {
  open: boolean;
  fileName: string;
  selectedText: string;
  onClose: () => void;
  onApply: (newText: string) => void;
}

const InlineChat: React.FC<InlineChatProps> = ({ open, fileName, selectedText, onClose, onApply }) => {
  const { t } = useI18n();
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setPrompt('');
      setResult('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, selectedText]);

  if (!open) return null;

  const run = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/ai/chat`, {
        messages: [
          { role: 'system', content: 'You are an inline code editor. Output ONLY the revised code — no markdown fences, no explanation.' },
          { role: 'user', content: `File: ${fileName}\n\nSelection:\n${selectedText}\n\nInstruction: ${prompt}` }
        ],
        stream: false,
        mode: 'agent'
      });
      const text = res.data?.message?.content || res.data?.content || '';
      setResult(text.trim());
    } catch (e: unknown) {
      setResult(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 4000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '15vh'
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '560px', background: '#1e1e1e', borderRadius: '12px', border: '1px solid #444',
        padding: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
      }}>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>{t('inlineChat.title')} · {fileName}</div>
        <textarea ref={inputRef} value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('inlineChat.placeholder')} rows={2}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } }}
          style={{ width: '100%', background: '#111', border: '1px solid #333', borderRadius: '8px',
            color: '#fff', padding: '10px', fontSize: '14px', resize: 'none', boxSizing: 'border-box' }} />
        {result && (
          <pre style={{ marginTop: '12px', padding: '10px', background: '#111', borderRadius: '8px',
            fontSize: '12px', maxHeight: '200px', overflow: 'auto', color: '#10b981', whiteSpace: 'pre-wrap' }}>{result}</pre>
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={secBtn}>{t('inlineChat.cancel')}</button>
          {result && (
            <button type="button" onClick={() => { onApply(result); onClose(); }} style={priBtn}>{t('inlineChat.apply')}</button>
          )}
          <button type="button" onClick={run} disabled={loading} style={priBtn}>{loading ? '…' : t('inlineChat.run')}</button>
        </div>
      </div>
    </div>
  );
};

const priBtn: React.CSSProperties = { background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' };
const secBtn: React.CSSProperties = { background: 'transparent', color: '#888', border: '1px solid #444', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' };

export default InlineChat;
