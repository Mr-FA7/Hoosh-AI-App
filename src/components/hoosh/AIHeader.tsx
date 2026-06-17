import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Plus, Zap, BookOpen, XOctagon, Radio } from 'lucide-react';
import { useHooshStore } from '../../hoosh/useHooshStore';
import type { HooshAgentRole } from '../../hoosh/types';
import { useI18n } from '../../i18n/LocaleContext';

const AGENT_CLASS: Record<HooshAgentRole, string> = {
  idle: 'text-slate-400',
  architect: 'text-violet-400',
  coder: 'text-sky-400',
  medic: 'text-emerald-400',
  qa_engineer: 'text-amber-300',
  negah: 'text-fuchsia-400'
};

function AgentStatusBar() {
  const { t } = useI18n();
  const activeAgent = useHooshStore((s) => s.activeAgent);
  const label = useMemo(() => {
    const map: Record<HooshAgentRole, string> = {
      idle: t('header.agentIdle'),
      architect: t('header.agentArchitect'),
      coder: t('header.agentCoder'),
      medic: t('header.agentMedic'),
      qa_engineer: t('header.agentQa'),
      negah: t('header.agentNegah')
    };
    return map[activeAgent] ?? map.idle;
  }, [t, activeAgent]);
  const className = AGENT_CLASS[activeAgent] ?? AGENT_CLASS.idle;

  return (
    <div
      role="status"
      aria-live="polite"
      title={t('header.agentStatusTitle')}
      className="flex min-w-0 max-w-full cursor-default select-none items-center gap-1 overflow-hidden rounded-full border border-white/10 bg-slate-900/60 px-1.5 py-0.5 backdrop-blur-md sm:gap-1.5 sm:px-2.5 sm:py-1 md:gap-2 md:px-3 md:py-1.5"
    >
      <Radio className="h-3 w-3 shrink-0 text-slate-500 sm:h-3.5 sm:w-3.5" aria-hidden />
      <span className="hidden shrink-0 text-[9px] font-semibold uppercase tracking-wider text-slate-500 sm:inline sm:text-[10px]">
        {t('header.persona')}
      </span>
      <AnimatePresence mode="wait">
        <motion.span
          key={activeAgent}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className={`min-w-0 truncate text-[10px] font-bold sm:text-xs ${className}`}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/** One size for every toolbar control so the row aligns (18px glyph in 40×40 box). */
const TB = {
  box: 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg p-0',
  icon: 'h-[18px] w-[18px]',
  stroke: 2.25 as const
};

function AbortButton({ onAbort }: { onAbort?: () => void }) {
  const { t } = useI18n();
  const isStreaming = useHooshStore((s) => s.isStreaming || s.chatStreaming);
  const abortMission = useHooshStore((s) => s.abortMission);

  if (!isStreaming) return null;

  return (
    <motion.button
      type="button"
      title={t('header.abortTitle')}
      onClick={(e) => {
        e.stopPropagation();
        onAbort ? onAbort() : abortMission();
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
      className={`${TB.box} rounded-xl border border-red-500/50 bg-red-950/40 text-red-400 shadow-[0_0_14px_rgba(239,68,68,0.4)] transition hover:bg-red-900/50`}
    >
      <XOctagon className={TB.icon} strokeWidth={TB.stroke} aria-hidden />
    </motion.button>
  );
}

export interface AIHeaderProps {
  onNewChat: () => void;
  onTempChat: () => void;
  onNotebook: () => void;
  /** Extra toolbar actions (e.g. history, vault, delete) rendered between center and status. */
  children?: React.ReactNode;
  /** Pulse sparkle when any stream is active (chat or mission). */
  pulseStreaming?: boolean;
  /** Abort chat + mission (e.g. companion PTY / local controller). Defaults to store.abortMission. */
  onAbort?: () => void;
}

const toolbarCellClass =
  'flex min-h-[40px] min-w-0 items-center justify-center [&_button]:relative [&_button]:z-20 [&_button]:touch-manipulation';

const AIHeader: React.FC<AIHeaderProps> = ({
  onNewChat,
  onTempChat,
  onNotebook,
  children,
  pulseStreaming,
  onAbort
}) => {
  const { t } = useI18n();
  const storeStreaming = useHooshStore((s) => s.isStreaming);
  const chatStreaming = useHooshStore((s) => s.chatStreaming);
  const showAbortSlot = storeStreaming || chatStreaming;
  const pulse = pulseStreaming ?? (storeStreaming || chatStreaming);
  const extraSlots = React.Children.toArray(children).filter(Boolean);
  const colCount = 3 + extraSlots.length + (showAbortSlot ? 1 : 0);

  return (
    <header className="flex min-w-0 shrink-0 flex-col gap-0 border-b border-white/[0.06] bg-slate-950/70 px-2 py-2 backdrop-blur-xl sm:px-4 sm:py-3">
      {/* Grid: row2 (Persona) width = row1 (icon + title) — chip cannot extend past the line above */}
      <div className="relative z-0 grid min-w-0 w-full max-w-full shrink-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 text-white sm:gap-x-2.5 sm:gap-y-1.5">
        <motion.span
          animate={pulse ? { scale: [1, 1.08, 1], opacity: [1, 0.85, 1] } : {}}
          transition={{ repeat: pulse ? Infinity : 0, duration: 2.2, ease: 'easeInOut' }}
          className="col-start-1 row-start-1 mt-[3px] inline-flex shrink-0"
        >
          <Sparkles className="h-[18px] w-[18px] text-violet-400" />
        </motion.span>
        <span
          className="col-start-2 row-start-1 min-w-0 truncate text-[14px] font-extrabold tracking-wide sm:text-[15px]"
          style={{
            background: 'linear-gradient(90deg, #fff, #94a3b8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          {t('header.brand')}
        </span>
        <div className="col-span-2 row-start-2 min-w-0 max-w-full overflow-hidden">
          <AgentStatusBar />
        </div>
      </div>

      {/* One grid column per icon so space splits evenly (children = one cell each, not one lump). */}
      <div
        className="relative z-10 mt-2 grid w-full min-w-0 gap-x-0 overflow-x-auto overscroll-x-contain border-t border-white/[0.07] px-0 pt-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 [&_svg]:shrink-0"
        style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
      >
        <div className={toolbarCellClass}>
          <button
            type="button"
            title={t('header.newChatTitle')}
            aria-label={t('header.newChatAria')}
            onClick={(e) => {
              e.stopPropagation();
              onNewChat();
            }}
            className={`${TB.box} border border-emerald-500/40 bg-emerald-950/55 text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.12)] transition hover:border-emerald-400/55 hover:bg-emerald-900/50 hover:text-white`}
          >
            <Plus className={TB.icon} strokeWidth={TB.stroke} aria-hidden />
          </button>
        </div>
        <div className={toolbarCellClass}>
          <button
            type="button"
            title={t('header.tempChatTitle')}
            onClick={(e) => {
              e.stopPropagation();
              onTempChat();
            }}
            className={`${TB.box} border border-white/10 bg-white/[0.04] text-amber-400 transition hover:bg-white/[0.08] hover:text-amber-300`}
          >
            <Zap className={TB.icon} strokeWidth={TB.stroke} />
          </button>
        </div>
        <div className={toolbarCellClass}>
          <button
            type="button"
            title={t('header.notebookTitle')}
            onClick={(e) => {
              e.stopPropagation();
              onNotebook();
            }}
            className={`${TB.box} border border-white/10 bg-white/[0.04] text-violet-400 transition hover:bg-white/[0.08] hover:text-violet-300`}
          >
            <BookOpen className={TB.icon} strokeWidth={TB.stroke} />
          </button>
        </div>
        {extraSlots.map((child, i) => (
          <div key={i} className={toolbarCellClass}>
            {child}
          </div>
        ))}
        {showAbortSlot ? (
          <div className={toolbarCellClass}>
            <AbortButton onAbort={onAbort} />
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default AIHeader;
