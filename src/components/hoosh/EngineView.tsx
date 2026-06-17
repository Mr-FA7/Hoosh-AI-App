import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Loader2 } from 'lucide-react';
import { API_BASE } from '../../apiBase';

/**
 * Side panel: **Tool vault only** (`tool_vault.json` — hoosh:vault:&lt;key&gt;).
 * Full OS / toolchain health is in the main workspace `components/EngineView.tsx` (Infrastructure Health).
 */
const HooshEngineView: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [vaultKeys, setVaultKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultErr, setVaultErr] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);

  const loadVault = useCallback(async () => {
    setVaultLoading(true);
    setVaultErr(null);
    try {
      const r = await fetch(`${API_BASE}/v3/vault`);
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as { ok?: boolean; entries?: Record<string, string> };
      const entries = j.entries && typeof j.entries === 'object' ? j.entries : {};
      const keys = Object.keys(entries).sort();
      setVaultKeys(keys);
      const first = keys[0] ?? null;
      setSelectedKey((k) => (k && k in entries ? k : first));
      setDraft(first ? String(entries[first] ?? '') : '');
    } catch (e) {
      setVaultErr(e instanceof Error ? e.message : String(e));
    } finally {
      setVaultLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVault();
  }, [loadVault]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`${API_BASE}/v3/vault`);
        if (!r.ok) return;
        const j = (await r.json()) as { entries?: Record<string, string> };
        const entries = j.entries && typeof j.entries === 'object' ? j.entries : {};
        if (selectedKey && selectedKey in entries) setDraft(String(entries[selectedKey] ?? ''));
      } catch {
        /* ignore */
      }
    })();
  }, [selectedKey]);

  const saveVault = async () => {
    if (!selectedKey?.trim()) return;
    setSaveBusy(true);
    setVaultErr(null);
    try {
      const rGet = await fetch(`${API_BASE}/v3/vault`);
      const jGet = await rGet.json().catch(() => ({}));
      const entries =
        jGet && typeof jGet === 'object' && jGet.entries && typeof jGet.entries === 'object'
          ? { ...jGet.entries }
          : {};
      entries[selectedKey] = draft;
      const r = await fetch(`${API_BASE}/v3/vault`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries })
      });
      if (!r.ok) throw new Error(await r.text());
      await loadVault();
    } catch (e) {
      setVaultErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-l border-white/[0.06] bg-slate-950/50 ${className}`}>
      <div className="shrink-0 border-b border-white/[0.06] px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <Database className="h-3.5 w-3.5 text-amber-400" />
          Tool vault
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-slate-600">
          System & toolchain health: use the main <span className="text-slate-500">Engine</span> view (Infrastructure Health). This panel only edits <code className="text-slate-500">hoosh:vault:&lt;key&gt;</code> scripts.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full min-h-[200px] flex-col gap-3">
          {vaultLoading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading vault…
            </div>
          ) : (
            <>
              {vaultErr && <p className="text-sm text-red-400">{vaultErr}</p>}
              <div className="flex flex-wrap gap-2">
                {vaultKeys.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setSelectedKey(k);
                      void (async () => {
                        const r = await fetch(`${API_BASE}/v3/vault`);
                        const j = await r.json().catch(() => ({}));
                        const ent = j?.entries?.[k];
                        setDraft(typeof ent === 'string' ? ent : '');
                      })();
                    }}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                      selectedKey === k
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                        : 'border-white/10 bg-black/30 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-[140px] w-full flex-1 rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[12px] text-slate-200 outline-none focus:ring-2 focus:ring-amber-500/30"
                placeholder={selectedKey ? `Script for “${selectedKey}”` : 'Select a vault key'}
                spellCheck={false}
              />
              <button
                type="button"
                disabled={saveBusy || !selectedKey}
                onClick={saveVault}
                className="rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {saveBusy ? 'Saving…' : 'Save to vault'}
              </button>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default HooshEngineView;
