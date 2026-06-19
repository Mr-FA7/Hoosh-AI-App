import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { Check, X, FileDiff, ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n/LocaleContext';

interface Proposal {
  fileName: string;
  original: string;
  proposed: string;
}

function computeHunks(original: string, proposed: string) {
  const o = original.split('\n');
  const p = proposed.split('\n');
  const hunks: { start: number; oEnd: number; pEnd: number }[] = [];
  let i = 0;
  while (i < Math.max(o.length, p.length)) {
    if (o[i] === p[i]) { i++; continue; }
    const start = i;
    while (i < Math.max(o.length, p.length) && o[i] !== p[i]) i++;
    hunks.push({ start, oEnd: i, pEnd: i });
  }
  return hunks;
}

function applyNextHunk(original: string, proposed: string, appliedCount: number) {
  const hunks = computeHunks(original, proposed);
  if (appliedCount >= hunks.length) return original;
  const h = hunks[appliedCount];
  const o = original.split('\n');
  const p = proposed.split('\n');
  const merged = [...o.slice(0, h.start), ...p.slice(h.start, h.pEnd), ...o.slice(h.oEnd)];
  return merged.join('\n');
}

interface ProposalUIProps {
  proposals: Proposal[];
  onApply: (fileName: string, content: string) => void;
  onClose: () => void;
}

const ProposalUI: React.FC<ProposalUIProps> = ({ proposals, onApply, onClose }) => {
  const { t } = useI18n();
  const [activeIndex, setActiveIndex] = useState(0);
  const [working, setWorking] = useState<Record<number, string>>({});
  const [hunkApplied, setHunkApplied] = useState<Record<number, number>>({});

  const [streaming, setStreaming] = useState(false);
  const streamRef = useRef<number | null>(null);

  const active = proposals[activeIndex];
  const displayOriginal = active?.original || '';
  const baseProposed = active?.proposed ?? '';
  const displayProposed = working[activeIndex] ?? baseProposed;
  const hunks = useMemo(() => computeHunks(displayOriginal, displayProposed), [displayOriginal, displayProposed]);
  const applied = hunkApplied[activeIndex] || 0;

  useEffect(() => {
    if (!active) return;
    if (streamRef.current) window.clearInterval(streamRef.current);
    setStreaming(true);
    const target = baseProposed;
    let i = 0;
    const step = Math.max(1, Math.floor(target.length / 80));
    streamRef.current = window.setInterval(() => {
      i += step;
      if (i >= target.length) {
        setWorking((w) => ({ ...w, [activeIndex]: target }));
        setStreaming(false);
        if (streamRef.current) window.clearInterval(streamRef.current);
        return;
      }
      setWorking((w) => ({ ...w, [activeIndex]: target.slice(0, i) }));
    }, 16);
    return () => {
      if (streamRef.current) window.clearInterval(streamRef.current);
    };
  }, [activeIndex, active?.fileName, baseProposed]);

  if (!active) return null;

  const ext = active.fileName.split('.').pop() || 'plaintext';
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', md: 'markdown', json: 'json', css: 'css', html: 'html'
  };
  const language = langMap[ext] || 'plaintext';

  const applyHunk = () => {
    const next = applyNextHunk(displayOriginal, displayProposed, applied);
    setWorking({ ...working, [activeIndex]: next });
    setHunkApplied({ ...hunkApplied, [activeIndex]: applied + 1 });
  };

  return (
    <div className="proposal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
    }}>
      <div className="proposal-modal" style={{
        width: '95%', height: '88%', background: '#1e1e1e', borderRadius: '12px',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #333'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileDiff size={20} color="#3b82f6" />
            <span style={{ fontWeight: 600 }}>{t('proposal.title')}</span>
            <span style={{ fontSize: '11px', color: '#888' }}>
              {hunks.length} hunks · {applied} applied{streaming ? ' · streaming…' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#aaa' }}>{active.fileName}</span>
            {applied < hunks.length && (
              <button onClick={applyHunk} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                {t('proposal.applyHunk')}
              </button>
            )}
            <button onClick={() => onApply(active.fileName, displayProposed)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={14} /> {t('proposal.apply')}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><X size={20} /></button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <DiffEditor height="100%" language={language} original={displayOriginal} modified={displayProposed}
            theme="vs-dark" options={{ readOnly: false, renderSideBySide: true, minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
            onMount={(editor) => {
              editor.getModifiedEditor()?.onDidChangeModelContent?.(() => {
                const v = editor.getModifiedEditor()?.getValue();
                if (v != null) setWorking({ ...working, [activeIndex]: v });
              });
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ProposalUI;
