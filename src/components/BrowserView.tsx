import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Globe, ExternalLink, ArrowLeft, ArrowRight, RefreshCcw, Download, Plus, X } from 'lucide-react';
import { API_BASE as API } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';

interface BrowserViewProps {
  navigateUrl?: string | null;
  onNavigateUrlConsumed?: () => void;
  /** Hide inner tab strip — used when opened as an editor workspace tab (tabs live in Editor). */
  embedded?: boolean;
}

interface BrowserTab {
  id: string;
  title: string;
  url: string;
  blockedNotice?: string;
}

const BrowserView: React.FC<BrowserViewProps> = ({ navigateUrl, onNavigateUrlConsumed, embedded = false }) => {
  const { t } = useI18n();
  const makeTab = useCallback(
    (seed?: string): BrowserTab => ({
      id: `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      title: seed ? t('browser.loadingTab') : t('browser.newTab'),
      url: seed || '',
      blockedNotice: ''
    }),
    [t]
  );
  const [input, setInput] = useState('');
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [frameSrc, setFrameSrc] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [giraBusy, setGiraBusy] = useState(false);
  const [frameBlockedNotice, setFrameBlockedNotice] = useState('');
  const [tabMenu, setTabMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const [faviconFailIndexByTab, setFaviconFailIndexByTab] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement | null>(null);
  const webviewRef = useRef<any>(null);
  const activeTabIdRef = useRef<string>('');
  const hasElectron = typeof (window as any).electronAPI !== 'undefined';

  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId) || null, [tabs, activeTabId]);

  useLayoutEffect(() => {
    setTabs((prev) => (prev.length === 0 ? [makeTab()] : prev));
  }, [makeTab]);

  const updateTab = (id: string, patch: Partial<BrowserTab>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const deriveTitle = (url: string, fallback?: string) => {
    const fb = fallback ?? t('browser.newTab');
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return host || fb;
    } catch {
      return fb;
    }
  };

  const deriveHost = (url: string) => {
    try {
      const host = new URL(url).hostname;
      return host || '';
    } catch {
      return '';
    }
  };

  const deriveOrigin = (url: string) => {
    try {
      return new URL(url).origin;
    } catch {
      return '';
    }
  };

  const faviconCandidatesForUrl = (url: string) => {
    const host = deriveHost(url);
    const origin = deriveOrigin(url);
    if (!host) return [];
    return [
      `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(origin || `https://${host}`)}&sz=32`,
      `https://icons.duckduckgo.com/ip3/${host}.ico`,
      `https://logo.clearbit.com/${host}`,
      origin ? `${origin}/favicon.ico` : `https://${host}/favicon.ico`
    ];
  };

  const isLikelyFrameBlockedHost = (url: string) => {
    try {
      const h = new URL(url).hostname.toLowerCase();
      return (
        h === 'google.com' ||
        h.endsWith('.google.com') ||
        h === 'github.com' ||
        h.endsWith('.github.com') ||
        h === 'accounts.google.com'
      );
    } catch {
      return false;
    }
  };

  const openExternalUrl = async (u: string) => {
    try {
      const res = await axios.post(`${API}/shell/open-external-url`, { url: u });
      if (!res.data?.ok) {
        window.alert(res.data?.error || 'Failed');
      }
    } catch (e: any) {
      window.alert(e?.message || 'Error');
    }
  };

  const navigateInTab = async (tabId: string, rawInput: string) => {
    const val = String(rawInput || '').trim();
    if (!val) return;
    try {
      const res = await axios.post(`${API}/v3/browser/kavosh/resolve`, { input: val });
      if (!res.data?.ok || !res.data?.url) {
        window.alert(res.data?.error || 'Navigation failed');
        return;
      }
      const url = String(res.data.url);
      const title = deriveTitle(url, t('browser.loadingTab'));
      updateTab(tabId, { url, title, blockedNotice: '' });
      setFaviconFailIndexByTab((prev) => ({ ...prev, [tabId]: 0 }));
      if (activeTabIdRef.current === tabId) {
        setInput(url);
        setCurrentUrl(url);
        setFrameBlockedNotice('');
      }

      // In browser-only dev mode, many major sites block iframe embedding.
      if (!hasElectron && isLikelyFrameBlockedHost(url)) {
        const proxyUrl = `${API}/v3/browser/kavosh/proxy?url=${encodeURIComponent(url)}`;
        updateTab(tabId, {
          blockedNotice: 'Proxy mode enabled for this site in web mode.'
        });
        if (activeTabIdRef.current === tabId) {
          setFrameSrc(proxyUrl);
          setFrameBlockedNotice('Proxy mode enabled for this site in web mode.');
        }
        return;
      }

      if (activeTabIdRef.current === tabId) {
        setFrameSrc(url);
      }
      if (hasElectron && activeTabIdRef.current === tabId && webviewRef.current?.loadURL) {
        webviewRef.current.loadURL(url);
      }
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.message || 'Navigation failed');
    }
  };

  const openNewTab = async (initialInput?: string) => {
    const tab = makeTab();
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    if (initialInput?.trim()) {
      await navigateInTab(tab.id, initialInput);
    }
  };

  const focusAddressInput = (selectAll = false) => {
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      if (selectAll) el.select();
    });
  };

  const copyText = async (txt: string) => {
    const value = String(txt || '').trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  const closeTab = (tabId: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId);
      return next.length ? next : [makeTab()];
    });
    if (activeTabIdRef.current === tabId) {
      setActiveTabId('');
      setFrameSrc('');
      setCurrentUrl('');
      setInput('');
      setFrameBlockedNotice('');
    }
    setFaviconFailIndexByTab((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
  };

  useEffect(() => {
    if (tabs.length && !activeTabId) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    if (!activeTab) return;
    setInput(activeTab.url || '');
    setCurrentUrl(activeTab.url || '');
    setFrameSrc(activeTab.url || '');
    setFrameBlockedNotice(activeTab.blockedNotice || '');
  }, [activeTab?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!navigateUrl?.trim() || !activeTabIdRef.current) return;
    const targetId = activeTab?.url ? null : activeTabIdRef.current;
    if (targetId) {
      navigateInTab(targetId, navigateUrl.trim());
    } else {
      openNewTab(navigateUrl.trim());
    }
    onNavigateUrlConsumed?.();
  }, [navigateUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv || !hasElectron) return;

    const update = () => {
      const url = String(wv.getURL?.() || '');
      const title = String(wv.getTitle?.() || deriveTitle(url, t('browser.newTab')));
      if (url) {
        const tabId = activeTabIdRef.current;
        updateTab(tabId, { url, title });
        setFaviconFailIndexByTab((prev) => ({ ...prev, [tabId]: 0 }));
        setCurrentUrl(url);
        setInput(url);
      }
    };
    const onStart = () => setIsLoading(true);
    const onStop = () => {
      setIsLoading(false);
      update();
    };

    wv.addEventListener?.('did-start-loading', onStart);
    wv.addEventListener?.('did-stop-loading', onStop);
    wv.addEventListener?.('did-navigate', onStop);
    wv.addEventListener?.('did-navigate-in-page', onStop);
    return () => {
      wv.removeEventListener?.('did-start-loading', onStart);
      wv.removeEventListener?.('did-stop-loading', onStop);
      wv.removeEventListener?.('did-navigate', onStop);
      wv.removeEventListener?.('did-navigate-in-page', onStop);
    };
  }, [hasElectron, frameSrc, t]);

  useEffect(() => {
    const close = () => setTabMenu(null);
    window.addEventListener('click', close);
    return () => {
      window.removeEventListener('click', close);
    };
  }, []);

  const openSystem = async () => {
    const u = (currentUrl || input).trim();
    await openExternalUrl(u);
  };

  const sendToGira = async () => {
    const u = (currentUrl || input).trim();
    if (!/^https?:\/\//i.test(u)) {
      window.alert('Open a valid URL first.');
      return;
    }
    setGiraBusy(true);
    try {
      const r = await axios.post(`${API}/v3/gira/download/direct`, { url: u });
      if (!r.data?.ok) {
        window.alert(r.data?.error || 'Gira failed');
        return;
      }
      window.alert(`Gira download started.\nJob ID: ${r.data.jobId}`);
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.message || 'Gira request failed');
    } finally {
      setGiraBusy(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#111',
        color: '#fff',
        minHeight: 0
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 20px',
          background: 'linear-gradient(180deg, rgba(30, 30, 30, 0.6) 0%, rgba(20, 20, 20, 0.4) 100%)',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          zIndex: 10,
          flexShrink: 0,
          flexWrap: 'wrap'
        }}
      >
        <Globe size={18} color="hsl(var(--accent))" />
        <span style={{ fontSize: '14px', fontWeight: 700 }}>{t('browser.title')}</span>
        {!embedded && (
          <button
            type="button"
            onClick={() => openNewTab()}
            title={t('browser.newTabButton')}
            style={{ background: 'hsl(var(--bg-panel))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--text-secondary))', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}
          >
            <Plus size={14} />
          </button>
        )}

        <button
          type="button"
          title={t('browser.back')}
          onClick={() => hasElectron && webviewRef.current?.canGoBack?.() && webviewRef.current.goBack()}
          style={{ background: 'hsl(var(--bg-panel))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--text-secondary))', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}
        >
          <ArrowLeft size={14} />
        </button>
        <button
          type="button"
          title={t('browser.forward')}
          onClick={() => hasElectron && webviewRef.current?.canGoForward?.() && webviewRef.current.goForward()}
          style={{ background: 'hsl(var(--bg-panel))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--text-secondary))', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}
        >
          <ArrowRight size={14} />
        </button>
        <button
          type="button"
          title={t('browser.reload')}
          onClick={() => {
            if (hasElectron && webviewRef.current?.reload) webviewRef.current.reload();
            else if (frameSrc) setFrameSrc(frameSrc);
          }}
          style={{ background: 'hsl(var(--bg-panel))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--text-secondary))', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}
        >
          <RefreshCcw size={14} />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && activeTabIdRef.current && navigateInTab(activeTabIdRef.current, input)}
          dir="ltr"
          placeholder={t('browser.urlPlaceholder')}
          style={{
            flex: 1,
            minWidth: '220px',
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'hsl(var(--text-primary))',
            borderRadius: '24px', // pill shape
            padding: '8px 24px',
            fontSize: '13px',
            outline: 'none',
            textAlign: 'center',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
            transition: 'all 0.2s'
          }}
          onFocus={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; e.currentTarget.style.borderColor = 'hsl(var(--accent))'; e.currentTarget.style.textAlign = 'left'; }}
          onBlur={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.textAlign = 'center'; }}
        />
        <button
          type="button"
          onClick={() => activeTabIdRef.current && navigateInTab(activeTabIdRef.current, input)}
          style={{
            background: 'hsl(var(--accent))',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 20px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 12px hsl(var(--accent) / 0.3)'
          }}
        >
          {t('browser.navigate')}
        </button>

        <button
          type="button"
          onClick={sendToGira}
          disabled={giraBusy}
          style={{
            background: 'hsl(142 72% 25%)',
            border: '1px solid hsl(142 60% 35%)',
            color: 'hsl(142 70% 80%)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Download size={14} />
          {giraBusy ? t('browser.giraSending') : t('gira.title')}
        </button>

        <button
          type="button"
          onClick={openSystem}
          style={{
            background: 'hsl(var(--bg-panel))',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--text-secondary))',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
        >
          <ExternalLink size={14} />
          {t('browser.system')}
        </button>
      </div>
      {!embedded && (
      <div
        style={{
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          overflowX: 'auto',
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(12, 12, 12, 0.95)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const faviconCandidates = faviconCandidatesForUrl(tab.url);
          const failIndex = faviconFailIndexByTab[tab.id] || 0;
          const currentFavicon = faviconCandidates[failIndex] || '';
          const canTryFavicon = faviconCandidates.length > 0 && failIndex < faviconCandidates.length;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTabMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: '140px',
                maxWidth: '220px',
                padding: '6px 8px',
                borderRadius: '8px',
                border: active ? '1px solid hsl(var(--accent) / 0.5)' : '1px solid #2b2b2b',
                background: active ? 'hsl(var(--accent) / 0.12)' : '#151515',
                color: active ? '#fff' : '#bbb',
                cursor: 'pointer'
              }}
            >
              {canTryFavicon && currentFavicon ? (
                <img
                  src={currentFavicon}
                  alt=""
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    flexShrink: 0,
                    border: '1px solid #2f2f2f',
                    background: '#111'
                  }}
                  onError={() =>
                    setFaviconFailIndexByTab((prev) => ({ ...prev, [tab.id]: (prev[tab.id] || 0) + 1 }))
                  }
                />
              ) : (
                <div
                  title="FA7"
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '7px',
                    fontWeight: 800,
                    lineHeight: 1,
                    color: '#ffffff',
                    border: '1px solid #5b4fd6',
                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.25) inset'
                  }}
                >
                  FA7
                </div>
              )}
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: '12px'
                }}
                title={tab.url || tab.title}
              >
                {tab.title || t('browser.newTab')}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#888',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex'
                }}
                title={t('browser.closeTab')}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => openNewTab()}
          title={t('browser.newTabButton')}
          style={{
            border: '1px dashed #3a3a3a',
            background: '#141414',
            color: '#bdbdbd',
            borderRadius: '8px',
            minWidth: '34px',
            height: '30px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          +
        </button>
      </div>
      )}

      {tabMenu && (
        <div
          style={{
            position: 'fixed',
            left: tabMenu.x,
            top: tabMenu.y,
            zIndex: 6000,
            background: '#121212',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '6px',
            minWidth: '180px',
            boxShadow: '0 12px 30px rgba(0,0,0,0.45)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              const row = tabs.find((x) => x.id === tabMenu.tabId);
              if (!row) return;
              setActiveTabId(row.id);
              setInput(row.url || '');
              setCurrentUrl(row.url || '');
              focusAddressInput(false);
              setTabMenu(null);
            }}
            style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#e5e7eb', padding: '7px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
          >
            {t('browser.editAddress')}
          </button>
          <button
            type="button"
            onClick={async () => {
              const row = tabs.find((x) => x.id === tabMenu.tabId);
              if (!row) return;
              await copyText(row.url || '');
              setTabMenu(null);
            }}
            style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#e5e7eb', padding: '7px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
          >
            {t('browser.copyAddress')}
          </button>
          <button
            type="button"
            onClick={() => {
              const row = tabs.find((x) => x.id === tabMenu.tabId);
              if (!row) return;
              setActiveTabId(row.id);
              setInput(row.url || '');
              setCurrentUrl(row.url || '');
              focusAddressInput(true);
              setTabMenu(null);
            }}
            style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#e5e7eb', padding: '7px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
          >
            {t('browser.selectAllAddress')}
          </button>
        </div>
      )}

      {!embedded && (
      <p style={{ margin: 0, padding: '8px 16px', fontSize: '10px', color: '#666', borderBottom: '1px solid #222' }}>
        {t('browser.footerHint')
          .replace('{loading}', isLoading ? t('browser.loadingSuffix') : '')
          .replace('{count}', String(tabs.length))}
      </p>
      )}
      {!!frameBlockedNotice && (
        <div
          style={{
            padding: '8px 16px',
            fontSize: '11px',
            color: '#fbbf24',
            borderBottom: '1px solid #332300',
            background: '#1a1400'
          }}
        >
          {frameBlockedNotice}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, background: '#0a0a0a' }}>
        {!hasElectron && !!frameBlockedNotice && !!currentUrl && !frameSrc ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px'
            }}
          >
            <div
              style={{
                width: 'min(680px, 100%)',
                border: '1px solid #3a2b00',
                background: '#171200',
                borderRadius: '12px',
                padding: '18px'
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#fbbf24', marginBottom: '8px' }}>
                Iframe blocked by site policy
              </div>
              <div style={{ fontSize: '12px', color: '#d6d3d1', lineHeight: 1.8, marginBottom: '12px' }}>
                {frameBlockedNotice}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#a8a29e',
                  background: '#0f0c00',
                  border: '1px solid #2a2200',
                  borderRadius: '8px',
                  padding: '10px',
                  marginBottom: '12px',
                  wordBreak: 'break-all'
                }}
              >
                {currentUrl}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => openExternalUrl(currentUrl)}
                  style={{
                    background: 'hsl(var(--bg-panel))',
                    border: '1px solid hsl(var(--border))',
                    color: 'hsl(var(--text-secondary))',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <ExternalLink size={13} />
                  Open In System Browser
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFrameBlockedNotice('');
                    setFrameSrc(currentUrl);
                  }}
                  style={{
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    color: '#e5e7eb',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Try In This Tab
                </button>
              </div>
            </div>
          </div>
        ) : frameSrc && hasElectron ? (
          <webview
            ref={webviewRef}
            src={frameSrc}
            allowpopups={true}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        ) : frameSrc ? (
          <iframe
            title="preview"
            src={frameSrc}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '13px' }}>
            Enter a URL or search query
          </div>
        )}
      </div>
    </div>
  );
};

export default BrowserView;
