import React, { useMemo } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { Check, X } from 'lucide-react';
import { useI18n } from '../i18n/LocaleContext';

export interface DiffZoneProposal {
  fileName: string;
  original: string;
  proposed: string;
}

interface DiffZoneOverlayProps {
  proposal: DiffZoneProposal | null;
  onApply: (content: string) => void;
  onReject: () => void;
}

const DiffZoneOverlay: React.FC<DiffZoneOverlayProps> = ({ proposal, onApply, onReject }) => {
  const { t } = useI18n();
  const language = useMemo(() => {
    const ext = proposal?.fileName.split('.').pop() || '';
    const map: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      py: 'python', md: 'markdown', json: 'json', css: 'css', html: 'html'
    };
    return map[ext] || 'plaintext';
  }, [proposal?.fileName]);

  if (!proposal) return null;

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: '42%',
      background: '#1a1a1a', borderTop: '2px solid #3b82f6', zIndex: 50,
      display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 32px rgba(0,0,0,0.5)'
    }}>
      <div style={{
        padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid #333', background: '#111'
      }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#93c5fd' }}>
          {t('diffZone.title')} — {proposal.fileName}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={() => onApply(proposal.proposed)}
            style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Check size={12} /> {t('diffZone.apply')}
          </button>
          <button type="button" onClick={onReject}
            style={{ background: 'transparent', color: '#888', border: '1px solid #444', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <DiffEditor
          height="100%"
          language={language}
          original={proposal.original}
          modified={proposal.proposed}
          theme="vs-dark"
          options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false }, fontSize: 12 }}
        />
      </div>
    </div>
  );
};

export default DiffZoneOverlay;
