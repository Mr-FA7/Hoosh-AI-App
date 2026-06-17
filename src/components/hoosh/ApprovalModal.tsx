import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useHooshStore } from '../../hoosh/useHooshStore';

const ApprovalModal: React.FC = () => {
  const isPaused = useHooshStore((s) => s.isPaused);
  const askQuestion = useHooshStore((s) => s.askQuestion);
  const resolveAsk = useHooshStore((s) => s.resolveAsk);
  const abortMission = useHooshStore((s) => s.abortMission);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPaused) {
      setInput('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isPaused, askQuestion]);

  if (!isPaused) return null;

  const submit = () => {
    const v = input.trim();
    if (!v) return;
    resolveAsk(v);
    setInput('');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hoosh-ask-title"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl shadow-black/50"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-amber-500/15 p-2 text-amber-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h2 id="hoosh-ask-title" className="text-base font-bold text-white">
              Input needed
            </h2>
            <p className="mt-1 text-sm text-slate-400">The agent paused and asked a question.</p>
          </div>
        </div>
        <p className="mb-4 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-slate-200">
          {askQuestion || 'Please provide the requested information.'}
        </p>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          className="mb-4 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none ring-violet-500/30 focus:ring-2"
          placeholder="Your answer…"
          autoComplete="off"
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={submit}
            className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            Provide info
          </button>
          <button
            type="button"
            onClick={() => abortMission()}
            className="rounded-xl border border-red-500/40 bg-red-950/40 px-5 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-900/50"
          >
            Abort
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ApprovalModal;
