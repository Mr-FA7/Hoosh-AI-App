import React, { useState, useEffect } from 'react';
import { Search, Download, Package, Star, Loader2, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { API_BASE as API_ROOT } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';

const MARKETPLACE_API = `${API_ROOT}/v3/marketplace`;

interface MarketplaceViewProps {
  onThemeApplied?: (themeName: string) => void;
}

const MarketplaceView: React.FC<MarketplaceViewProps> = ({ onThemeApplied }) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [extensions, setExtensions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<'search' | 'installed'>('search');
  const [installed, setInstalled] = useState<any[]>([]);

  useEffect(() => {
    if (viewTab === 'installed') {
      fetchInstalled();
    } else {
      handleSearch('');
    }
  }, [viewTab]);

  const fetchInstalled = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${MARKETPLACE_API}/installed`);
      setInstalled(res.data);
    } catch (e) {
      console.error('Failed to fetch installed extensions', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (q: string) => {
    const term = q.trim();
    if (!term && q !== '') return;
    
    setLoading(true);
    try {
      const res = await axios.get(`${MARKETPLACE_API}/search`, {
        params: { q: term }
      });
      const items = res.data.extensions || (Array.isArray(res.data) ? res.data : []);
      setExtensions(items);
    } catch (e) {
      console.error('[Marketplace] Search failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (ext: any) => {
    const id = (ext.namespace || ext.publisher) + '.' + ext.name;
    setInstalling(id);
    try {
      const res = await axios.post(`${MARKETPLACE_API}/install`, {
        namespace: ext.namespace || ext.publisher,
        name: ext.name,
        version: ext.version,
        downloadUrl: ext.files.download
      });
      
      if (res.data.success) {
        alert(
          t('marketplace.alertInstalled').replace('{name}', String(ext.displayName || ext.name || ext.namespace || ext.publisher || ext.name))
        );
        if (viewTab === 'installed') fetchInstalled();
      }
    } catch (e: any) {
      console.error('[Marketplace] Install failed:', e);
      const err = String(e?.response?.data?.error || e?.message || 'unknown');
      alert(t('marketplace.alertInstallFailed').replace('{error}', err));
    } finally {
      setInstalling(null);
    }
  };

  const handleApplyTheme = async (ext: any, theme: any) => {
    try {
      const res = await axios.get(`${MARKETPLACE_API}/theme-content`, {
        params: {
          localPath: ext.localPath,
          themePath: theme.path
        }
      });
      const themeData = res.data;
      
      if ((window as any).monaco) {
          const m = (window as any).monaco;
          m.editor.defineTheme('custom-ext-theme', {
            base: theme.uiTheme === 'vs-dark' ? 'vs-dark' : 'vs',
            inherit: true,
            rules: themeData.tokenColors ? themeData.tokenColors.map((tc: any) => ({
                token: tc.scope ? (Array.isArray(tc.scope) ? tc.scope[0] : tc.scope) : '',
                foreground: tc.settings.foreground,
                fontStyle: tc.settings.fontStyle
            })) : [],
            colors: themeData.colors || {}
          });
          m.editor.setTheme('custom-ext-theme');
      }

      if (themeData.colors) {
          const colors = themeData.colors;
          let styleTag = document.getElementById('fa7-dynamic-theme');
          if (!styleTag) {
              styleTag = document.createElement('style');
              styleTag.id = 'fa7-dynamic-theme';
              document.head.appendChild(styleTag);
          }
          
          styleTag.innerHTML = `
            :root {
              ${colors['editor.background'] ? `--bg-main-override: ${colors['editor.background']};` : ''}
              ${colors['sideBar.background'] ? `--bg-sidebar-override: ${colors['sideBar.background']};` : ''}
              ${colors['activityBar.background'] ? `--bg-panel-override: ${colors['activityBar.background']};` : ''}
              ${colors['button.background'] ? `--accent-override: ${colors['button.background']};` : ''}
              ${colors['editor.foreground'] ? `--text-primary-override: ${colors['editor.foreground']};` : ''}
              ${colors['editorGroup.border'] ? `--border-override: ${colors['editorGroup.border']};` : ''}
            }
            body, .workspace-container, .editor-section { background-color: var(--bg-main-override, hsl(var(--bg-main))) !important; }
            .sidebar, .file-explorer { background-color: var(--bg-sidebar-override, hsl(var(--bg-sidebar))) !important; }
            .ai-panel { background-color: var(--bg-panel-override, hsl(var(--bg-panel))) !important; }
            .btn-primary, [style*="background: hsl(var(--accent))"] { background-color: var(--accent-override, hsl(var(--accent))) !important; }
            body { color: var(--text-primary-override, hsl(var(--text-primary))) !important; }
          `;

          if (onThemeApplied) onThemeApplied('custom-ext-theme');
          alert(`Theme "${theme.label}" applied!`);
      }
    } catch (e) {
      console.error('Failed to apply theme', e);
      alert(t('marketplace.alertApplyThemeFailed'));
    }
  };

  return (
    <div className="marketplace-view" style={{ padding: '30px', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px' }}>
        <div style={{ padding: '10px', background: 'hsl(var(--accent) / 0.1)', borderRadius: '12px' }}>
             <Package size={24} color="hsl(var(--accent))" />
        </div>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>{t('marketplace.title')}</h2>
          <p style={{ fontSize: '13px', color: 'hsl(var(--text-secondary))', margin: 0 }}>{t('marketplace.poweredBy')}</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '10px' }}>
             <button 
               onClick={() => setViewTab('search')}
               style={{ 
                 padding: '6px 16px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                 background: viewTab === 'search' ? 'hsl(var(--accent))' : 'transparent',
                 color: viewTab === 'search' ? 'black' : 'white'
               }}
             >{t('marketplace.tabExplore')}</button>
             <button 
               onClick={() => setViewTab('installed')}
               style={{ 
                 padding: '6px 16px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                 background: viewTab === 'installed' ? 'hsl(var(--accent))' : 'transparent',
                 color: viewTab === 'installed' ? 'black' : 'white'
               }}
             >{t('marketplace.tabInstalled')}</button>
        </div>
      </div>

      {viewTab === 'search' && (
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSearch(query); }}
          style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}
        >
          <div style={{ position: 'relative', flex: 1 }}>
            <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} size={18} />
            <input 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('marketplace.searchPlaceholder')}
              style={{
                width: '100%', background: 'hsl(var(--bg-sidebar) / 0.5)', border: '1px solid hsl(var(--border))', borderRadius: '12px',
                padding: '14px 14px 14px 46px', fontSize: '14px', color: 'white', outline: 'none', boxSizing: 'border-box'
              }}
            />
            {loading && <Loader2 className="animate-spin" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} size={18} />}
          </div>
          <button type="submit" disabled={loading} style={{ background: 'hsl(var(--accent))', border: 'none', borderRadius: '12px', color: 'black', padding: '0 24px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            {t('marketplace.search')}
          </button>
        </form>
      )}

      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', paddingBottom: '30px' }}>
        {(viewTab === 'search' ? extensions : installed).map((ext) => (
          <div 
            key={(ext.namespace || ext.publisher) + '.' + ext.name}
            style={{ 
              background: 'hsl(var(--bg-sidebar) / 0.2)', border: '1px solid hsl(var(--border) / 0.5)', borderRadius: '16px', 
              padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'default'
            }}
          >
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: '#222', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {ext.files?.icon ? <img src={ext.files.icon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={24} style={{ opacity: 0.3 }} />}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ext.displayName || ext.name}</div>
                <div style={{ fontSize: '11px', color: 'hsl(var(--accent))', fontWeight: 600 }}>{ext.namespace || ext.publisher}</div>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', margin: 0, lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {ext.description}
            </p>

            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '10px', opacity: 0.4 }}>
                {ext.downloadCount?.toLocaleString()} {t('marketplace.installs')}
              </div>
              
              {viewTab === 'search' ? (
                <button 
                  onClick={() => handleInstall(ext)}
                  disabled={!!installing}
                  style={{ background: 'hsl(var(--accent))', border: 'none', borderRadius: '8px', color: 'black', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: installing ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {installing === (ext.namespace || ext.publisher) + '.' + ext.name ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {t('marketplace.installing')}
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      {t('marketplace.install')}
                    </>
                  )}
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', alignItems: 'flex-end' }}>
                   {ext.themes && ext.themes.length > 0 && (
                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'flex-end' }}>
                        {ext.themes.map((t: any) => (
                           <button key={t.label} onClick={() => handleApplyTheme(ext, t)} style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', color: 'rgb(192, 132, 252)', fontWeight: 700, cursor: 'pointer' }}>
                             {t('marketplace.applyTheme').replace('{label}', String(t.label))}
                           </button>
                        ))}
                     </div>
                   )}
                   <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'hsl(var(--accent))', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                      <CheckCircle size={12} />
                      {t('marketplace.installed')}
                   </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MarketplaceView;
