import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, ShieldCheck, ShieldAlert, CheckCircle, Power, Download, FolderLock, Terminal, Globe, Plug, KeyRound } from 'lucide-react';
import axios from 'axios';
import { API_BASE as API_ROOT } from '../apiBase';

const SKILL_API = `${API_ROOT}/v3/skill`;

interface SkillPermissions {
  filesystem: string;
  shell: { allowlist: string[] };
  network: string[];
  mcp: string[];
  secrets: string[];
}

interface Skilllisting {
  id: string;
  name: string;
  version: string;
  category: string;
  summary: string;
  source: string;
  promptOnly: boolean;
  valid: boolean;
  permissions: SkillPermissions;
  permissionsSummary: string;
  elevated: boolean;
  installed: boolean;
  active: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  coding: '59,130,246', 'cloud-devops': '14,165,233', ai: '168,85,247', research: '34,197,94',
  business: '234,179,8', marketing: '236,72,153', design: '244,114,182', security: '239,68,68',
  'legal-assist': '148,163,184', personal: '113,113,122'
};

const SkillsMarketplace: React.FC = () => {
  const [skills, setSkills] = useState<SkilllListingState>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [grantFor, setGrantFor] = useState<Skilllisting | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${SKILL_API}/catalog`);
      if (r.data?.ok) setSkills(r.data.skills || []);
    } catch (e) {
      console.error('[Skills] catalog failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Install → open the permission-grant screen (nothing is granted until approved).
  const startInstall = async (s: SkillistingItem) => {
    setBusy(s.id);
    try {
      const r = await axios.post(`${SKILL_API}/${s.id}/install`);
      if (r.data?.ok) setGrantFor(s);
      else alert(r.data?.error || 'Install failed');
    } catch (e: unknown) {
      alert((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Install failed');
    } finally {
      setBusy(null);
    }
  };

  // Approve the requested permissions, then activate.
  const grantAndActivate = async (s: SkillistingItem) => {
    setBusy(s.id);
    try {
      await axios.post(`${SKILL_API}/${s.id}/grant`, { permissions: s.permissions });
      await axios.post(`${SKILL_API}/${s.id}/activate`, { active: true });
      setGrantFor(null);
      await load();
    } catch (e: unknown) {
      alert((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Grant failed');
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = async (s: SkillistingItem) => {
    setBusy(s.id);
    try {
      await axios.post(`${SKILL_API}/${s.id}/activate`, { active: !s.active });
      await load();
    } catch (e) {
      console.error('[Skills] toggle failed', e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '30px' }}>
      {loading && skills.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.6, padding: '20px' }}>
          <Loader2 size={16} className="animate-spin" /> Loading skills…
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {skills.map((s) => {
          const rgb = CATEGORY_COLORS[s.category] || '113,113,122';
          return (
            <div key={s.id} style={{
              background: 'hsl(var(--bg-sidebar) / 0.2)', border: '1px solid hsl(var(--border) / 0.5)',
              borderRadius: '16px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'white' }}>{s.name}</div>
                  <div style={{ fontSize: '11px', color: `rgb(${rgb})`, fontWeight: 600, marginTop: '2px' }}>
                    {s.category} · v{s.version} · {s.source}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {!s.promptOnly && !s.elevated && (
                    <span title="Verified (passes evals + minimal permissions)" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'rgb(34,197,94)', fontWeight: 700 }}>
                      <ShieldCheck size={13} /> verified
                    </span>
                  )}
                  {s.elevated && (
                    <span title="Requests elevated permissions — review carefully" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'rgb(234,179,8)', fontWeight: 700 }}>
                      <ShieldAlert size={13} /> elevated
                    </span>
                  )}
                </div>
              </div>

              <p style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', margin: 0, lineHeight: 1.5, minHeight: '34px' }}>
                {s.summary || (s.promptOnly ? 'Prompt-only Skill (no manifest).' : '')}
              </p>

              {/* Up-front permissions summary — users see what a Skill can touch before installing */}
              <div style={{ fontSize: '10px', color: 'hsl(var(--text-secondary))', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '8px 10px', lineHeight: 1.6 }}>
                <PermLine icon={<FolderLock size={11} />} label="fs" value={s.permissions.filesystem} />
                <PermLine icon={<Terminal size={11} />} label="shell" value={s.permissions.shell.allowlist.join(', ') || 'none'} />
                <PermLine icon={<Globe size={11} />} label="net" value={s.permissions.network.join(', ') || 'none'} />
                <PermLine icon={<Plug size={11} />} label="mcp" value={s.permissions.mcp.join(', ') || 'none'} />
                <PermLine icon={<KeyRound size={11} />} label="secrets" value={s.permissions.secrets.join(', ') || 'none'} />
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                {!s.installed && (
                  <button onClick={() => startInstall(s)} disabled={busy === s.id} style={btn('hsl(var(--accent))', 'black')}>
                    {busy === s.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Install
                  </button>
                )}
                {s.installed && !s.active && (
                  <button onClick={() => setGrantFor(s)} disabled={busy === s.id} style={btn('hsl(var(--accent))', 'black')}>
                    <Power size={13} /> Grant & Activate
                  </button>
                )}
                {s.installed && s.active && (
                  <button onClick={() => toggleActive(s)} disabled={busy === s.id} style={btn('rgba(34,197,94,0.12)', 'rgb(34,197,94)', 'rgba(34,197,94,0.3)')}>
                    <CheckCircle size={13} /> Active — deactivate
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {grantFor && (
        <PermissionGrantModal
          skill={grantFor}
          busy={busy === grantFor.id}
          onCancel={() => setGrantFor(null)}
          onApprove={() => grantAndActivate(grantFor)}
        />
      )}
    </div>
  );
};

const PermLine: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
    <span style={{ opacity: 0.7, display: 'flex' }}>{icon}</span>
    <span style={{ opacity: 0.6, minWidth: '44px' }}>{label}</span>
    <span style={{ color: value === 'none' ? 'hsl(var(--text-secondary))' : 'white', opacity: value === 'none' ? 0.5 : 0.9 }}>{value}</span>
  </div>
);

const PermissionGrantModal: React.FC<{ skill: SkillistingItem; busy: boolean; onCancel: () => void; onApprove: () => void }> = ({ skill, busy, onCancel, onApprove }) => (
  <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: '460px', maxWidth: '90vw', background: 'hsl(var(--bg-sidebar))', border: '1px solid hsl(var(--border))', borderRadius: '16px', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        {skill.elevated ? <ShieldAlert size={20} color="rgb(234,179,8)" /> : <ShieldCheck size={20} color="rgb(34,197,94)" />}
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Grant permissions to “{skill.name}”</h3>
      </div>
      <p style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', margin: '0 0 16px' }}>
        This Skill requested the capabilities below. It gets nothing else. All actions run through Hoosh’s sandbox and appear in the audit log.
      </p>
      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', lineHeight: 1.9 }}>
        <PermLine icon={<FolderLock size={13} />} label="Files" value={skill.permissions.filesystem} />
        <PermLine icon={<Terminal size={13} />} label="Shell" value={skill.permissions.shell.allowlist.join(', ') || 'none'} />
        <PermLine icon={<Globe size={13} />} label="Network" value={skill.permissions.network.join(', ') || 'none'} />
        <PermLine icon={<Plug size={13} />} label="MCP" value={skill.permissions.mcp.join(', ') || 'none'} />
        <PermLine icon={<KeyRound size={13} />} label="Secrets" value={skill.permissions.secrets.join(', ') || 'none'} />
      </div>
      {skill.elevated && (
        <div style={{ marginTop: '12px', fontSize: '11px', color: 'rgb(234,179,8)', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <ShieldAlert size={13} /> This Skill requests elevated access (arbitrary paths, secrets, or broad network). Approve only if you trust it.
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
        <button onClick={onCancel} style={btn('transparent', 'white', 'hsl(var(--border))')}>Cancel</button>
        <button onClick={onApprove} disabled={busy} style={btn('hsl(var(--accent))', 'black')}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Approve & Activate
        </button>
      </div>
    </div>
  </div>
);

function btn(bg: string, color: string, border?: string): React.CSSProperties {
  return {
    background: bg, color, border: border ? `1px solid ${border}` : 'none', borderRadius: '8px',
    padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '6px'
  };
}

// local type aliases (kept loose to tolerate backend shape drift)
type SkillistingItem = Skilllisting;
type SkilllListingState = SkillistingItem[];

export default SkillsMarketplace;
