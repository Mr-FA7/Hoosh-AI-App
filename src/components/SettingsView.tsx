import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Monitor, Shield, User, Languages } from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';
import LanguageSwitcher from './LanguageSwitcher';
import AgentSettingsPanel from './settings/AgentSettingsPanel';
import { BUILTIN_THEMES, applyExtensionTheme } from '../lib/themeApply';

interface SettingsViewProps {
  currentTheme?: string;
  onThemeChange?: (theme: string) => void;
}

const SettingSection = ({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; children: React.ReactNode }) => (
  <div style={{ marginBottom: '32px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid hsl(var(--border) / 0.3)', paddingBottom: '8px' }}>
      <Icon size={18} color="hsl(var(--accent))" strokeWidth={2.5} />
      <h2 style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-primary))' }}>{title}</h2>
    </div>
    <div style={{ paddingLeft: '28px' }}>{children}</div>
  </div>
);

const InfoRow = ({ label, value, active = false }: { label: string; value: React.ReactNode; active?: boolean }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px' }}>
    <span style={{ opacity: 0.6 }}>{label}</span>
    <span style={{ fontWeight: 600, color: active ? 'hsl(142 71% 45%)' : 'inherit' }}>{value}</span>
  </div>
);

const SettingsView: React.FC<SettingsViewProps> = ({ currentTheme = 'vs-dark', onThemeChange }) => {
  const { t } = useI18n();
  const [hw, setHw] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [projectRoot, setProjectRoot] = useState('');

  const [githubStatus, setGithubStatus] = useState<any>(null);
  const [clientId, setClientId] = useState('');
  const [scopes, setScopes] = useState('repo');
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [repoName, setRepoName] = useState('');
  const [repoDescription, setRepoDescription] = useState('');
  const [publishMode, setPublishMode] = useState<'git' | 'api'>('git');
  const [isPrivate, setIsPrivate] = useState(true);
  const [publishResult, setPublishResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [extThemes, setExtThemes] = useState<any[]>([]);

  useEffect(() => {
    axios.get(`${API_BASE}/v3/extensions/themes`).then((r) => {
      setExtThemes(r.data?.themes || []);
    }).catch(() => setExtThemes([]));
  }, []);

  const handleBuiltinTheme = (id: string) => {
    const monaco = (window as any).monaco;
    if (monaco?.editor?.setTheme) monaco.editor.setTheme(id);
    localStorage.setItem('fa7_editor_theme', id);
    onThemeChange?.(id);
  };

  const handleExtensionTheme = (theme: any) => {
    if (!theme?.theme) return;
    applyExtensionTheme(theme.theme, theme.uiTheme || 'vs-dark', onThemeChange);
  };

  useEffect(() => {
    fetchHw();
    fetchGithubStatus();
    fetchProjectPath();
  }, []);

  const fetchHw = async () => {
    try {
      const res = await axios.get(`${API_BASE}/v3/system/information`);
      setHw(res.data);
    } catch (e) {
      console.error('Failed to fetch hardware info', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectPath = async () => {
    try {
      const res = await axios.get(`${API_BASE}/v3/project/path`);
      setProjectRoot(res.data?.path || '');
    } catch {
      setProjectRoot('');
    }
  };

  const fetchGithubStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/v3/github/auth/status`);
      setGithubStatus(res.data);
    } catch (e) {
      console.error('Failed to fetch github status', e);
    }
  };

  const startBusy = () => {
    setBusy(true);
    setPublishResult(null);
  };

  const endBusy = () => setBusy(false);

  const handleSaveClientId = async () => {
    try {
      startBusy();
      await axios.post(`${API_BASE}/v3/github/config`, { client_id: clientId.trim() });
      await fetchGithubStatus();
      setPublishResult({ ok: true, message: t('settings.savedClientId') });
    } catch (e: any) {
      setPublishResult({ ok: false, error: e?.response?.data?.error || e.message });
    } finally {
      endBusy();
    }
  };

  const handleStartDevice = async () => {
    try {
      startBusy();
      const res = await axios.post(`${API_BASE}/v3/github/auth/device/start`, {
        scopes: scopes.split(/[,\s]+/).filter(Boolean)
      });
      setDeviceInfo(res.data);
      setPublishResult({ ok: true, message: t('settings.deviceStarted') });
    } catch (e: any) {
      setPublishResult({ ok: false, error: e?.response?.data?.error || e.message });
    } finally {
      endBusy();
    }
  };

  const handlePollDevice = async () => {
    try {
      startBusy();
      const res = await axios.post(`${API_BASE}/v3/github/auth/device/poll`, {});
      if (res.data?.ok) {
        setDeviceInfo(null);
      }
      await fetchGithubStatus();
      setPublishResult(res.data);
    } catch (e: any) {
      setPublishResult({ ok: false, error: e?.response?.data?.error || e.message });
    } finally {
      endBusy();
    }
  };

  const handleLogout = async () => {
    try {
      startBusy();
      await axios.post(`${API_BASE}/v3/github/auth/logout`, {});
      setDeviceInfo(null);
      await fetchGithubStatus();
      setPublishResult({ ok: true, message: t('settings.loggedOut') });
    } catch (e: any) {
      setPublishResult({ ok: false, error: e?.response?.data?.error || e.message });
    } finally {
      endBusy();
    }
  };

  const handleCreateRepo = async () => {
    if (!repoName.trim()) {
      setPublishResult({ ok: false, error: t('settings.repoRequired') });
      return;
    }
    try {
      startBusy();
      const res = await axios.post(`${API_BASE}/v3/github/repos`, {
        name: repoName.trim(),
        description: repoDescription.trim(),
        private: isPrivate
      });
      setPublishResult(res.data);
    } catch (e: any) {
      setPublishResult(e?.response?.data || { ok: false, error: e.message });
    } finally {
      endBusy();
    }
  };

  const handlePublish = async () => {
    if (!repoName.trim()) {
      setPublishResult({ ok: false, error: t('settings.repoRequired') });
      return;
    }
    try {
      startBusy();
      const res = await axios.post(`${API_BASE}/v3/github/publish`, {
        mode: publishMode,
        repoName: repoName.trim(),
        description: repoDescription.trim(),
        private: isPrivate,
        projectRoot
      });
      setPublishResult(res.data);
    } catch (e: any) {
      setPublishResult(e?.response?.data || { ok: false, error: e.message });
    } finally {
      endBusy();
    }
  };

  const authLabel = useMemo(() => {
    if (!githubStatus) return t('settings.authUnknown');
    return githubStatus.authenticated
      ? `${t('settings.authConnected')} ${githubStatus.user?.login || 'user'}`
      : t('settings.authNotConnected');
  }, [githubStatus, t]);

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', paddingBottom: '80px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '24px', background: 'linear-gradient(to right, #fff, #666)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t('settings.pageTitle')}</h1>

      <SettingSection title={t('settings.appearance')} icon={Monitor}>
        <p style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', marginBottom: '12px' }}>{t('settings.editorThemeHint')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          {BUILTIN_THEMES.map((th) => (
            <button
              key={th.id}
              type="button"
              onClick={() => handleBuiltinTheme(th.id)}
              style={{
                padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
                border: currentTheme === th.id ? '1px solid hsl(var(--accent))' : '1px solid hsl(var(--border))',
                background: currentTheme === th.id ? 'hsl(var(--accent) / 0.15)' : 'transparent',
                color: 'hsl(var(--text-primary))'
              }}
            >
              {th.label}
            </button>
          ))}
        </div>
        {extThemes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {extThemes.map((th) => (
              <button
                key={`${th.extension}-${th.id}`}
                type="button"
                onClick={() => handleExtensionTheme(th)}
                style={{
                  padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
                  border: '1px solid hsl(var(--border))', background: 'transparent', color: 'hsl(var(--text-primary))'
                }}
              >
                {th.label || th.id}
              </button>
            ))}
          </div>
        )}
      </SettingSection>

      <div
        style={{
          marginBottom: '32px',
          padding: '20px 22px',
          borderRadius: '14px',
          border: '1px solid hsl(var(--border) / 0.35)',
          background: 'hsl(var(--bg-sidebar) / 0.35)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <Languages size={18} color="hsl(var(--accent))" strokeWidth={2.5} />
          <h2 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'hsl(var(--text-primary))' }}>{t('lang.section')}</h2>
        </div>
        <p style={{ fontSize: '12px', opacity: 0.72, marginBottom: '14px', lineHeight: 1.5 }}>{t('lang.hint')}</p>
        <LanguageSwitcher />
      </div>

      <SettingSection title={t('settings.systemInfo')} icon={Monitor}>
        {loading ? (
          <div style={{ opacity: 0.5 }}>{t('settings.gathering')}</div>
        ) : hw ? (
          <div style={{ background: 'hsl(var(--bg-sidebar) / 0.3)', padding: '24px', borderRadius: '12px', border: '1px solid hsl(var(--border) / 0.3)' }}>
            <InfoRow label={t('settings.aiOllama')} value={hw?.ollama?.status || t('settings.active')} active={true} />
            <InfoRow
              label={t('settings.cpu')}
              value={(() => {
                const brand = hw?.cpu_brand || hw?.cpu?.brand || t('settings.unknown');
                const c = hw?.cpu;
                const bits: string[] = [brand];
                if (c && typeof c.cores === 'number' && typeof c.threads === 'number') {
                  bits.push(
                    c.cores === c.threads ? `${c.cores} cores` : `${c.cores} cores / ${c.threads} threads`
                  );
                }
                if (c?.speed_mhz && c.speed_mhz > 0) {
                  bits.push(
                    c.speed_mhz >= 1000
                      ? `${(c.speed_mhz / 1000).toFixed(2)} GHz`
                      : `${c.speed_mhz} MHz`
                  );
                }
                return bits.join(' · ');
              })()}
            />
            <InfoRow
              label={t('settings.gpu')}
              value={(() => {
                const g = hw?.gpu as any;
                if (!g || g.vendor === 'none') return t('settings.unknown');
                const name = g.name || (g.vendor === 'apple' ? 'Apple GPU' : String(g.vendor).toUpperCase() + ' GPU');
                const bits = [name];
                if (typeof g.total_vram === 'number' && g.total_vram > 0) {
                  bits.push(g.total_vram >= 1024
                    ? `${(g.total_vram / 1024).toFixed(0)} GB VRAM`
                    : `${g.total_vram} MB VRAM`);
                }
                if (g.compute_api && g.compute_api !== 'none') bits.push(g.compute_api.toUpperCase());
                return bits.join(' · ');
              })()}
            />
            <InfoRow
              label={t('settings.ram')}
              value={(() => {
                const mb = hw?.ram?.total;
                if (!mb) return t('settings.unknown');
                const gb = mb / 1024;
                return gb >= 1 ? `${gb.toFixed(gb >= 10 ? 0 : 1)} GB` : `${mb} MB`;
              })()}
            />
            <InfoRow
              label={t('settings.motherboard')}
              value={(hw as any)?.motherboard || (hw?.ram as any)?.is_unified ? 'Apple Silicon' : t('settings.unknown')}
            />
            <InfoRow label={t('settings.storage')} value={`${hw?.storage?.total || t('settings.unknown')} (${hw?.storage?.used || '0'} used) (${hw?.storage?.free || '0'} free)`} />
          </div>
        ) : (
          <div style={{ color: 'hsl(var(--destructive))' }}>{t('settings.systemError')}</div>
        )}
      </SettingSection>

      <SettingSection title={t('settings.account')} icon={User}>
        <InfoRow label={t('settings.user')} value={t('settings.profileLocal')} />
        <InfoRow label={t('settings.license')} value={t('settings.licenseFree')} />
      </SettingSection>

      <SettingSection title={t('settings.github')} icon={User}>
        <div style={{ background: 'hsl(var(--bg-sidebar) / 0.3)', padding: '16px', borderRadius: '12px', border: '1px solid hsl(var(--border) / 0.3)' }}>
          <InfoRow label={t('settings.githubStatus')} value={authLabel} active={!!githubStatus?.authenticated} />
          <InfoRow label={t('settings.defaultVisibility')} value={t('settings.private')} active={isPrivate} />

          <div style={{ margin: '10px 0 14px 0' }}>
            <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '6px' }}>{t('settings.clientId')}</div>
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="e.g. 01ab8ac9400c4e429b23"
              style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid hsl(var(--border) / 0.4)', background: 'transparent', color: 'inherit' }}
            />
          </div>

          <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={handleSaveClientId} disabled={busy} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid hsl(var(--border) / 0.4)', background: 'transparent', color: 'inherit' }}>{t('settings.saveClientId')}</button>
            <button onClick={fetchGithubStatus} disabled={busy} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid hsl(var(--border) / 0.4)', background: 'transparent', color: 'inherit' }}>{t('settings.refreshStatus')}</button>
            <button onClick={handleLogout} disabled={busy} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid hsl(var(--destructive) / 0.4)', background: 'transparent', color: 'hsl(var(--destructive))' }}>{t('settings.logout')}</button>
          </div>

          <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '6px' }}>{t('settings.scopes')}</div>
          <input
            value={scopes}
            onChange={(e) => setScopes(e.target.value)}
            placeholder="repo"
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid hsl(var(--border) / 0.4)', background: 'transparent', color: 'inherit' }}
          />

          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={handleStartDevice} disabled={busy} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid hsl(var(--accent) / 0.5)', background: 'hsl(var(--accent) / 0.15)', color: 'hsl(var(--accent))' }}>{t('settings.startDeviceLogin')}</button>
            <button onClick={handlePollDevice} disabled={busy} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid hsl(var(--border) / 0.4)', background: 'transparent', color: 'inherit' }}>{t('settings.pollLogin')}</button>
            {deviceInfo?.verification_uri && (
              <button
                onClick={() => window.open(deviceInfo.verification_uri, '_blank')}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid hsl(var(--border) / 0.4)', background: 'transparent', color: 'inherit' }}
              >
                {t('settings.openGithubPage')}
              </button>
            )}
          </div>

          {deviceInfo?.user_code && (
            <div style={{ marginTop: '10px', fontSize: '13px', opacity: 0.9 }}>
              {t('settings.codeLabel')} <strong>{deviceInfo.user_code}</strong> {t('settings.atLabel')} <strong>{deviceInfo.verification_uri}</strong>
            </div>
          )}

          <hr style={{ margin: '16px 0', borderColor: 'hsl(var(--border) / 0.3)' }} />

          <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '6px' }}>{t('settings.repoName')}</div>
          <input
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            placeholder="my-repo"
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid hsl(var(--border) / 0.4)', background: 'transparent', color: 'inherit', marginBottom: '8px' }}
          />

          <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '6px' }}>{t('settings.description')}</div>
          <input
            value={repoDescription}
            onChange={(e) => setRepoDescription(e.target.value)}
            placeholder={t('settings.optional')}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid hsl(var(--border) / 0.4)', background: 'transparent', color: 'inherit', marginBottom: '10px' }}
          />

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              {t('settings.privateDefault')}
            </label>
            <label style={{ fontSize: '13px' }}>
              {t('settings.publishMode')}
              <select value={publishMode} onChange={(e) => setPublishMode(e.target.value as 'git' | 'api')} style={{ marginLeft: 8, padding: '4px 8px', borderRadius: 6, background: 'transparent', color: 'inherit' }}>
                <option value="git">git</option>
                <option value="api">api-only</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={handleCreateRepo} disabled={busy} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid hsl(var(--border) / 0.4)', background: 'transparent', color: 'inherit' }}>{t('settings.createRepo')}</button>
            <button onClick={handlePublish} disabled={busy} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid hsl(var(--accent) / 0.5)', background: 'hsl(var(--accent) / 0.15)', color: 'hsl(var(--accent))' }}>{t('settings.publishProject')}</button>
          </div>

          <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.65 }}>
            {t('settings.projectRoot')} {projectRoot || t('settings.unknown')}
          </div>

          {publishResult && (
            <pre style={{ marginTop: '12px', fontSize: '11px', maxHeight: '200px', overflow: 'auto', padding: '10px', borderRadius: '8px', background: 'hsl(var(--bg-main) / 0.6)', border: '1px solid hsl(var(--border) / 0.3)' }}>
{JSON.stringify(publishResult, null, 2)}
            </pre>
          )}
        </div>
      </SettingSection>

      <SettingSection title={t('settings.about')} icon={User}>
        <div style={{ display: 'grid', gap: '10px', fontSize: '12px', lineHeight: 1.7 }}>
          <div><strong>{t('settings.appName')}</strong> Hoosh</div>
          <div><strong>{t('settings.agentName')}</strong> Hoosh</div>
          <div><strong>{t('settings.creator')}</strong> Fardin Ahrari (FA7)</div>
          <div><strong>{t('settings.engines')}</strong> OS = FA7 OS, Browser = Kavosh, Downloads = Gira</div>
        </div>
      </SettingSection>

      <SettingSection title={t('settings.security')} icon={Shield}>
        <div style={{ fontSize: '12px', opacity: 0.5, lineHeight: 1.6 }}>{t('settings.securityBlurb')}</div>
      </SettingSection>

      <SettingSection title={t('settings.notifications')} icon={Bell}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" checked readOnly style={{ accentColor: 'hsl(var(--accent))' }} />
          <span style={{ fontSize: '13px', opacity: 0.7 }}>{t('settings.notifyAgents')}</span>
        </div>
      </SettingSection>

      <SettingSection title={t('agentSettings.title')} icon={Shield}>
        <AgentSettingsPanel embedded />
      </SettingSection>
    </div>
  );
};

export default SettingsView;
