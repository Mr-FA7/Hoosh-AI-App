import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Shield } from 'lucide-react';
import axios from 'axios';
import { useHooshStore } from '../../hoosh/useHooshStore';
import { API_BASE } from '../../apiBase';
import { useI18n } from '../../i18n/LocaleContext';

interface PendingApproval {
  id: string;
  tool: string;
  category: string;
  args: Record<string, unknown>;
}

const ApprovalModal: React.FC = () => {
  const { t } = useI18n();
  const isPaused = useHooshStore((s) => s.isPaused);
  const askQuestion = useHooshStore((s) => s.askQuestion);
  const resolveAsk = useHooshStore((s) => s.resolveAsk);
  const abortMission = useHooshStore((s) => s.abortMission);
  const chatStreaming = useHooshStore((s) => s.chatStreaming);
  const isStreaming = useHooshStore((s) => s.isStreaming);

  const [input, setInput] = useState('');
  const [pendingTool, setPendingTool] = useState<PendingApproval | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!chatStreaming && !isStreaming) return;
    const poll = setInterval(async () => {
      try {
        const r = await axios.get(`${API_BASE}/v3/approval/pending`);
        const list = r.data?.pending || [];
        if (list.length > 0) setPendingTool(list[0]);
        else setPendingTool(null);
      } catch { /* ignore */ }
    }, 1500);
    return () => clearInterval(poll);
  }, [chatStreaming, isStreaming]);

  useEffect(() => {
    if (isPaused) {
      setInput('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isPaused, askQuestion]);

  const respondTool = async (approved: boolean) => {
    if (!pendingTool) return;
    await axios.post(`${API_BASE}/v3/approval/respond`, { id: pendingTool.id, approved });
    setPendingTool(null);
  };

  if (pendingTool) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl">
        <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }}
          className="mx-4 w-full max-w-lg rounded-2xl border border-amber-500/30 bg-slate-950/90 p-6 shadow-2xl">
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-xl bg-amber-500/15 p-2 text-amber-400"><Shield className="h-6 w-6" /></div>
            <div>
              <h2 className="text-base font-bold text-white">{t('approval.toolTitle')}</h2>
              <p className="mt-1 text-sm text-slate-400">{t('approval.toolDesc')}</p>
            </div>
          </div>
          <div className="mb-4 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-slate-200">
            <div><strong>{pendingTool.tool}</strong> <span className="text-amber-400">({pendingTool.category})</span></div>
            <pre className="mt-2 max-h-32 overflow-auto text-xs text-slate-400">{JSON.stringify(pendingTool.args, null, 2)}</pre>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => respondTool(true)}
              className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500">
              {t('approval.allow')}
            </button>
            <button type="button" onClick={() => respondTool(false)}
              className="flex-1 rounded-xl border border-red-500/40 bg-red-950/40 py-3 text-sm font-semibold text-red-300 hover:bg-red-900/50">
              {t('approval.deny')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  if (!isPaused) return null;

  const submit = () => {
    const v = input.trim();
    if (!v) return;
    resolveAsk(v);
    setInput('');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl"
      role="dialog" aria-modal="true">
      <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }}
        className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-amber-500/15 p-2 text-amber-400"><AlertTriangle className="h-6 w-6" /></div>
          <div>
            <h2 className="text-base font-bold text-white">{t('approval.askTitle')}</h2>
            <p className="mt-1 text-sm text-slate-400">{t('approval.askDesc')}</p>
          </div>
        </div>
        <p className="mb-4 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-slate-200">
          {askQuestion || t('approval.askDefault')}
        </p>
        <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          className="mb-4 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none"
          placeholder={t('approval.answerPlaceholder')} autoComplete="off" />
        <div className="flex gap-3">
          <button type="button" onClick={submit}
            className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500">
            {t('approval.provide')}
          </button>
          <button type="button" onClick={() => abortMission()}
            className="rounded-xl border border-red-500/40 bg-red-950/40 px-5 py-3 text-sm font-semibold text-red-300">
            {t('approval.abort')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ApprovalModal;
