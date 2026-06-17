import React from 'react';
import { Check, X, FileDiff } from 'lucide-react';
import { useI18n } from '../i18n/LocaleContext';

interface Proposal {
  fileName: string;
  original: string;
  proposed: string;
}

interface ProposalUIProps {
  proposals: Proposal[];
  onApply: (fileName: string, content: string) => void;
  onClose: () => void;
}

const ProposalUI: React.FC<ProposalUIProps> = ({ proposals, onApply, onClose }) => {
  const { t } = useI18n();
  return (
    <div className="proposal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
    }}>
      <div className="proposal-modal" style={{
        width: '90%', height: '80%', background: '#1e1e1e', borderRadius: '12px',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #333'
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileDiff size={20} color="#3b82f6" />
            <span style={{ fontWeight: 600 }}>{t('proposal.title')}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {proposals.map((prop, i) => (
            <div key={i} style={{ marginBottom: '30px', background: '#252525', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333' }}>
              <div style={{ padding: '10px 15px', background: '#333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 500 }}>{prop.fileName}</span>
                <button 
                  onClick={() => onApply(prop.fileName, prop.proposed)}
                  style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={12} /> {t('proposal.apply')}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#333' }}>
                <div style={{ padding: '15px', background: '#1e1e1e', fontSize: '12px', color: '#888' }}>
                  <div style={{ marginBottom: '10px', fontWeight: 600 }}>{t('proposal.original')}</div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{prop.original.substring(0, 500)}...</pre>
                </div>
                <div style={{ padding: '15px', background: '#1e1e1e', fontSize: '12px', color: '#10b981' }}>
                  <div style={{ marginBottom: '10px', fontWeight: 600 }}>{t('proposal.proposed')}</div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{prop.proposed.substring(0, 500)}...</pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProposalUI;
