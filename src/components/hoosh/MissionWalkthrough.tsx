import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Circle } from 'lucide-react';
import { useHooshStore } from '../../hoosh/useHooshStore';
import type { CognitiveLogEntry } from '../../hoosh/types';

const TAG_GLOW: Record<string, string> = {
  thinking: 'shadow-[0_0_15px_rgba(167,139,250,0.55)]',
  planning: 'shadow-[0_0_15px_rgba(139,92,246,0.55)]',
  reading: 'shadow-[0_0_15px_rgba(251,191,36,0.45)]',
  searching: 'shadow-[0_0_15px_rgba(251,191,36,0.45)]',
  executing: 'shadow-[0_0_15px_rgba(59,130,246,0.55)]',
  terminal: 'shadow-[0_0_15px_rgba(59,130,246,0.55)]',
  writing: 'shadow-[0_0_15px_rgba(52,211,153,0.45)]',
  rewriting: 'shadow-[0_0_15px_rgba(16,185,129,0.45)]',
  ask: 'shadow-[0_0_15px_rgba(248,113,113,0.5)]',
  done: 'shadow-[0_0_12px_rgba(74,222,128,0.4)]',
  error: 'shadow-[0_0_15px_rgba(248,113,113,0.55)]'
};

function LogRow({ log }: { log: CognitiveLogEntry }) {
  const active = log.status === 'active';
  const glow = TAG_GLOW[log.tag] ?? 'shadow-[0_0_12px_rgba(148,163,184,0.35)]';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{
        opacity: log.status === 'done' ? 0.6 : 1,
        x: 0
      }}
      className={`relative rounded-xl border border-white/[0.08] bg-slate-900/50 px-3 py-2.5 ${
        active ? `ring-1 ring-violet-500/30 ${glow}` : ''
      } ${active ? 'animate-pulse' : ''}`}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">[{log.tag}]</span>
        {active && <Circle className="h-2 w-2 fill-violet-400 text-violet-400" />}
      </div>
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-200">{log.message}</p>
      {log.payload && (
        <details className="mt-2">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-200">
            <ChevronRight className="h-3.5 w-3.5 transition group-open:rotate-90" />
            Tool payload
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-white/10 bg-black/50 p-3 text-[11px] text-slate-300">
            {log.payload}
          </pre>
        </details>
      )}
    </motion.div>
  );
}

const MissionWalkthrough: React.FC<{ className?: string }> = ({ className = '' }) => {
  const logs = useHooshStore((s) => s.cognitiveLogs);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <aside
      className={`flex min-h-0 w-full min-w-0 flex-1 flex-col border-l border-white/[0.06] bg-slate-950/40 ${className}`}
    >
      <div className="border-b border-white/[0.06] px-3 py-2">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Mission trace</h3>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3 [scrollbar-width:thin]">
        {logs.length === 0 ? (
          <p className="text-center text-[12px] text-slate-600">No mission steps yet. Start a mission from the engine or chat.</p>
        ) : (
          logs.map((log) => <LogRow key={log.id} log={log} />)
        )}
        <div ref={bottomRef} />
      </div>
    </aside>
  );
};

export default MissionWalkthrough;
