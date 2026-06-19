import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  Send, Sparkles, MessageSquare, Loader2, X, FolderOpen, File, Trash2,
  Plus, Paperclip, BookOpen, AlertCircle, Zap, Brain, HelpCircle,
  Activity, Search, Mic, MicOff, ListOrdered, Cloud, HardDrive,
  StopCircle, Lock, Server, CheckCircle2, Save, Wand2, Copy, Check, Undo2, Play,
  Image as ImageIcon, Code, FileText, Globe, RefreshCw, ChevronRight, Pin, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FA7Mode,
  FA7_STUDIO_SYSTEM_PROMPT,
  FA7_ASSET_STUDIO_HINT,
  FA7_VM_LAB_HINT,
  FA7_TERMINAL_CONTEXT_HINT,
  getModeSystemPrompt,
  getRulePrompt,
  getNotebookContext,
  extractRulesFromMessage
} from '../fa7StudioProtocol';
import {
  FA7_AI_BROWSER_SYSTEM_HINT
} from '../fa7AiBrowserProtocol';
import { runFa7ActionsFromAssistant, stripFa7ActionTags } from '../fa7ActionRunner';
import AIHeader from './hoosh/AIHeader';
import ApprovalModal from './hoosh/ApprovalModal';
import CheckpointPanel from './hoosh/CheckpointPanel';
import { useHooshStore } from '../hoosh/useHooshStore';
import { API_BASE } from '../apiBase';
import { runChatStream } from '../hoosh/agentService';
import { useI18n } from '../i18n/LocaleContext';
import { mermaidToPlanMarkdown } from '../flowchart/mermaidPlan';
import {
  AGENT_INJECT_EVENT,
  AGENT_MISSION_EVENT,
  type AgentInjectDetail,
  type AgentMissionDetail
} from '../lib/agentContextBridge';
import { dispatchAgentVisualAction, mapUiAgentEvent } from '../lib/agentVisualBridge';

const CHAT_SESSIONS_KEY = 'fa7_chat_sessions_v1';
const ACTIVE_CHAT_SESSION_KEY = 'fa7_active_chat_session_v1';
const BACKEND_SESSION_MAP_KEY = 'fa7_backend_session_map_v1';
const AGENT_TERMINAL_SESSION_KEY = 'hoosh_agent_terminal_session';

type ChatMsg =
  | { role: 'user'; content: string; attachments?: UploadedAsset[] }
  | { role: 'assistant'; content: string }
  | { role: 'studio_notice'; content: string }
  | { role: 'system_info'; content: string }
  | { role: 'change_stats'; content: string; stats: AiChangeStats };

interface ContextFile {
  path: string;
  content: string;
}

interface UploadedAsset {
  name: string;
  type: string;
  content: string;
  dataUrl?: string;
}

function truncateCtx(s: string, max: number): string {
  if (!s || s.length <= max) return s;
  return s.slice(0, max) + '\n… [truncated]';
}

function buildHooshSystemBlock(
  mode: FA7Mode,
  activeFile: string | null,
  currentContent: string,
  contextFiles: ContextFile[]
): string {
  const parts: string[] = [FA7_STUDIO_SYSTEM_PROMPT, getModeSystemPrompt(mode)];
  if (mode === 'agent') parts.push(FA7_AI_BROWSER_SYSTEM_HINT);
  if (activeFile) {
    parts.push(`## Active file: ${activeFile}`);
    if (currentContent) parts.push('```\n' + truncateCtx(currentContent, 24000) + '\n```');
  }
  if (contextFiles.length > 0) {
    parts.push('## Context files');
    for (const f of contextFiles.slice(0, 16)) {
      parts.push(`### ${f.path}\n\`\`\`\n${truncateCtx(f.content, 16000)}\n\`\`\``);
    }
  }
  return parts.join('\n\n');
}

/** User message this assistant index is replying to (scan backward; skips studio_notice, etc.). */
function findPrecedingUserIndex(messages: ChatMsg[], assistantIndex: number): number {
  for (let j = assistantIndex - 1; j >= 0; j--) {
    if (messages[j].role === 'user') return j;
  }
  return -1;
}

function chatThreadToApiMessages(
  thread: ChatMsg[],
  systemBlock: string
): Array<{ role: string; content: string }> {
  const api: Array<{ role: string; content: string }> = [{ role: 'system', content: systemBlock }];
  for (const m of thread) {
    if (m.role === 'user') {
      let c = m.content;
      if (m.attachments?.length) {
        c += '\n\n[Attachments]';
        for (const a of m.attachments) {
          if (a.dataUrl) c += `\n\n[Image: ${a.name} (${a.type})]`;
          else c += `\n\n### ${a.name}\n\`\`\`\n${truncateCtx(a.content, 100000)}\n\`\`\``;
        }
      }
      api.push({ role: 'user', content: c });
    } else if (m.role === 'assistant') {
      api.push({ role: 'assistant', content: m.content });
    }
  }
  return api;
}

/** Maps kernel /api/ai/chat mission stream events to the Active Mission card in AIPanel. */
function reduceMissionState(
  prev: { name?: string; plan: any; steps: any[]; status: string } | null,
  ev: Record<string, unknown>,
  tr: (key: string) => string
): { name?: string; plan: any; steps: any[]; status: string } | null {
  const t = String(ev.type || '');
  if (t === 'model_chunk' || t === 'token' || t === 'rescan' || t === 'done') return prev;

  if (prev === null) {
    if (t === 'status') return null;
    if (t !== 'mission_name' && t !== 'plan' && t !== 'step_start' && t !== 'step_complete' && t !== 'finish' && t !== 'error') {
      return null;
    }
  }

  const empty = (): { name?: string; plan: any; steps: any[]; status: string } => ({
    name: undefined,
    plan: undefined,
    steps: [],
    status: tr('aiPanel.missionPending')
  });

  const base = prev ?? empty();

  switch (t) {
    case 'mission_name': {
      const name = typeof ev.name === 'string' ? ev.name : base.name;
      return { ...base, name, status: name ? `«${name}»` : base.status };
    }
    case 'plan': {
      const rawSteps = Array.isArray((ev as { steps?: unknown }).steps) ? (ev as { steps: any[] }).steps : [];
      const steps = rawSteps.map((s: { id?: number; task?: string; assignee?: string }) => ({
        id: s.id,
        task: String(s.task || ''),
        assignee: s.assignee,
        status: 'pending' as const
      }));
      return { ...base, plan: ev, steps, status: tr('aiPanel.executingPlan') };
    }
    case 'step_start': {
      const id = Number((ev as { id?: number }).id);
      if (!Number.isFinite(id)) return base;
      const task = String((ev as { task?: string }).task || '');
      const assignee = (ev as { assignee?: string }).assignee;
      let steps = [...(base.steps || [])];
      const ix = steps.findIndex((s: { id: number }) => s.id === id);
      if (ix >= 0) {
        steps[ix] = {
          ...steps[ix],
          task: task || steps[ix].task,
          assignee: assignee ?? steps[ix].assignee,
          status: 'running'
        };
      } else {
        steps.push({ id, task, assignee, status: 'running' });
      }
      steps = steps.map((s: { id: number; status: string }) => {
        if (s.id < id && s.status === 'pending') return { ...s, status: 'completed' };
        return s;
      });
      return { ...base, steps, status: tr('aiPanel.stepRunning').replace(/\{id\}/g, String(id)) };
    }
    case 'step_complete': {
      const id = Number((ev as { id?: number }).id);
      if (!Number.isFinite(id)) return base;
      const steps = (base.steps || []).map((s: { id: number }) =>
        s.id === id ? { ...s, status: 'completed', result: (ev as { result?: unknown }).result } : s
      );
      return { ...base, steps, status: tr('aiPanel.stepCompleted') };
    }
    case 'status': {
      if (typeof ev.message === 'string') return { ...base, status: ev.message };
      return base;
    }
    case 'finish': {
      const steps = (base.steps || []).map((s: { status: string }) =>
        s.status === 'running' ? { ...s, status: 'completed' } : s
      );
      return {
        ...base,
        steps,
        status: typeof ev.message === 'string' ? ev.message : tr('aiPanel.completed')
      };
    }
    case 'error': {
      return {
        ...base,
        status: `${tr('aiPanel.errorPrefix')} ${typeof ev.message === 'string' ? ev.message : tr('aiPanel.unknownErr')}`
      };
    }
    default:
      return prev;
  }
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  mode: FA7Mode;
  messages: ChatMsg[];
  currentMission: { name?: string; plan: any; steps: any[]; status: string } | null;
  pinned: boolean;
  temporary?: boolean;
  backendSessionId?: string;
}

interface AiChangeStats {
  addedLines: number;
  replacedLines: number;
  removedLines: number;
  filesCreated: number;
  filesUpdated: number;
  filesDeleted: number;
}

interface AgentStep {
  id: number;
  task: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
  agent?: string;
  assignee?: string;
}

interface ModelAccessPrefs {
  mode?: 'online' | 'offline' | 'hybrid' | 'user';
  allowOnline: boolean;
  allowOffline: boolean;
  allowHybrid: boolean;
  enabledModels: string[];
}

const DEFAULT_MODEL_PREFS: ModelAccessPrefs = {
  mode: 'hybrid',
  allowOnline: true,
  allowOffline: true,
  allowHybrid: true,
  enabledModels: []
};

function readModelPrefs(): ModelAccessPrefs {
  try {
    const raw = localStorage.getItem('hoosh_model_preferences_v1');
    if (!raw) return { ...DEFAULT_MODEL_PREFS };
    const parsed = JSON.parse(raw);
    const mode = parsed?.mode === 'online' || parsed?.mode === 'offline' || parsed?.mode === 'hybrid' || parsed?.mode === 'user' ? parsed.mode : 'hybrid';
    return {
      mode,
      allowOnline: parsed?.allowOnline !== false,
      allowOffline: parsed?.allowOffline !== false,
      allowHybrid: parsed?.allowHybrid !== false,
      enabledModels: Array.isArray(parsed?.enabledModels) ? parsed.enabledModels.map((x: any) => String(x)).filter(Boolean) : []
    };
  } catch {
    return { ...DEFAULT_MODEL_PREFS };
  }
}

function ollamaNamesCompatible(a: string, b: string): boolean {
  const x = String(a || '').trim();
  const y = String(b || '').trim();
  if (!x || !y) return false;
  if (x === y) return true;
  return x.startsWith(y + ':') || y.startsWith(x + ':');
}

function expandUserEnabledToCatalogNames(enabledRaw: Set<string>, catalog: any[]): Set<string> {
  const out = new Set<string>();
  for (const row of catalog) {
    const name = String(row?.name || '').trim();
    if (!name) continue;
    for (const en of enabledRaw) {
      if (ollamaNamesCompatible(name, String(en))) {
        out.add(name);
        break;
      }
    }
  }
  return out;
}

function computeEffectiveEnabled(modelPrefs: ModelAccessPrefs, catalog: any[]): Set<string> {
  if (modelPrefs.mode === 'online') {
    return new Set(catalog.filter((m: any) => !!m?.available_online || /(?:-cloud$|:cloud$)/i.test(String(m?.name || ''))).map((m: any) => String(m?.name || '')).filter(Boolean));
  }
  if (modelPrefs.mode === 'offline') {
    return new Set(catalog.filter((m: any) => !!m?.installed).map((m: any) => String(m?.name || '')).filter(Boolean));
  }
  if (modelPrefs.mode === 'hybrid') {
    return new Set(catalog.map((m: any) => String(m?.name || '')).filter(Boolean));
  }
  const raw = new Set(modelPrefs.enabledModels.filter(Boolean));
  if (raw.size === 0) return new Set();
  return expandUserEnabledToCatalogNames(raw, catalog);
}

function computeEligibleModels(modelPrefs: ModelAccessPrefs, catalog: any[]): any[] {
  const effectiveEnabled = computeEffectiveEnabled(modelPrefs, catalog);
  return catalog.filter((m: any) => {
    const name = String(m?.name || '');
    if (!name || !effectiveEnabled.has(name)) return false;
    if (modelPrefs.allowHybrid) return true;
    if (modelPrefs.allowOffline && !!m?.installed) return true;
    if (modelPrefs.allowOnline && (!!m?.available_online || /(?:-cloud$|:cloud$)/i.test(name))) return true;
    return false;
  });
}

function findCatalogModelByName(catalog: any[], name: string): any | undefined {
  const n = String(name || '').trim();
  const exact = catalog.find((m: any) => String(m?.name || '') === n);
  if (exact) return exact;
  return catalog.find((m: any) => ollamaNamesCompatible(n, String(m?.name || '')));
}

function canonicalizeModelToEligible(requested: string, eligibleModels: any[]): string {
  const req = String(requested || '').trim();
  const exact = eligibleModels.find((m: any) => String(m?.name || '') === req);
  if (exact) return String(exact.name);
  const compat = eligibleModels.filter((m: any) => ollamaNamesCompatible(req, String(m?.name || '')));
  if (compat.length === 0) return req;
  if (compat.length === 1) return String(compat[0].name);
  const installed = compat.find((m: any) => m.installed);
  if (installed) return String(installed.name);
  const sorted = [...compat].sort((a, b) => String(b.name).length - String(a.name).length);
  return String(sorted[0].name);
}

// ✨ Extract Domain Helper
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const getAgentIcon = (assignee: string) => {
  const a = assignee?.toLowerCase();
  if (a?.includes('frontend')) return '🎨';
  if (a?.includes('backend')) return '⚙️';
  if (a?.includes('qa')) return '🔍';
  if (a?.includes('devops')) return '🚀';
  if (a?.includes('medic')) return '🩹';
  if (a?.includes('architect')) return '📐';
  if (a?.includes('pm') || a?.includes('ceo')) return '📋';
  return '🤖';
};

function fileListFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  if (dt.files && dt.files.length > 0) return Array.from(dt.files);
  return [];
}

// 💎 LUXURY COGNITIVE STREAM FORMATTER
const formatCognitiveMessage = (text: string, isGenerating: boolean) => {
  let lines = text.split('\n');

  if (!isGenerating) {
    // Completely filter out tags and trim excessive empty lines
    lines = lines.filter(line => !line.match(/^\[(.*?)\](.*)/));
    while (lines.length > 0 && lines[0].trim() === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  }

  return lines.map((line, i) => {
    const match = line.match(/^\[(.*?)\](.*)/);
    if (match && isGenerating) {
      const tag = match[1].toLowerCase();
      const rest = match[2];

      let color = '#9ca3af';
      let bgColor = 'rgba(255, 255, 255, 0.03)';
      let icon = <Brain size={13} />;
      let borderColor = 'rgba(255, 255, 255, 0.08)';

      if (tag === 'executing' || tag === 'terminal') { color = '#60a5fa'; bgColor = 'rgba(59, 130, 246, 0.1)'; borderColor = 'rgba(59, 130, 246, 0.3)'; icon = <Server size={13} />; }
      else if (tag === 'writing' || tag === 'rewriting') { color = '#34d399'; bgColor = 'rgba(16, 185, 129, 0.1)'; borderColor = 'rgba(16, 185, 129, 0.3)'; icon = <Save size={13} />; }
      else if (tag === 'reading' || tag === 'searching') { color = '#fbbf24'; bgColor = 'rgba(245, 158, 11, 0.1)'; borderColor = 'rgba(245, 158, 11, 0.3)'; icon = <Search size={13} />; }
      else if (tag === 'planning') { color = '#a78bfa'; bgColor = 'rgba(139, 92, 246, 0.1)'; borderColor = 'rgba(139, 92, 246, 0.3)'; icon = <ListOrdered size={13} />; }
      else if (tag === 'done') { color = '#4ade80'; bgColor = 'rgba(34, 197, 94, 0.1)'; borderColor = 'rgba(34, 197, 94, 0.3)'; icon = <CheckCircle2 size={13} />; }
      else if (tag === 'ask' || tag === 'error') { color = '#f87171'; bgColor = 'rgba(239, 68, 68, 0.1)'; borderColor = 'rgba(239, 68, 68, 0.3)'; icon = <HelpCircle size={13} />; }

      return (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          key={i}
          style={{
            display: 'flex', gap: '12px', alignItems: 'center',
            marginTop: '8px', marginBottom: '8px',
            background: bgColor, padding: '10px 14px',
            borderRadius: '10px', border: `1px solid ${borderColor}`,
            color: '#e5e7eb', fontSize: '13px',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
          }}
        >
          <span style={{ color, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(0,0,0,0.3)' }}>{icon}</span>
          <span style={{ opacity: 0.95, lineHeight: 1.5 }}>{rest}</span>
        </motion.div>
      );
    }
    if (line.trim() === '') return <div key={i} style={{ height: '4px' }} />;
    return <div key={i} style={{ marginTop: '4px', color: '#e4e4e7', lineHeight: '1.6' }}>{line}</div>;
  });
};

// ✨ Content Parser (Extracts text, code, and sources safely)
function parseAssistantContent(text: string, isGenerating: boolean) {
  const sources: { title: string; url: string }[] = [];
  const cleanedText = text.replace(/---SOURCES_START---\n?([\s\S]*?)\n?---SOURCES_END---/g, (match, srcContent) => {
    const linkRegex = /-\s*\[(.*?)\]\((.*?)\)/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(srcContent)) !== null) {
      sources.push({ title: linkMatch[1].trim(), url: linkMatch[2].trim() });
    }
    return '';
  });

  const parts: Array<{ type: 'text' | 'code', content: string, lang?: string }> = [];
  const codeRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeRegex.exec(cleanedText)) !== null) {
    if (match.index > lastIndex) parts.push({ type: 'text', content: cleanedText.slice(lastIndex, match.index) });
    parts.push({ type: 'code', lang: match[1] || '', content: match[2] });
    lastIndex = match.index + match[0].length;
  }

  let remainingText = cleanedText.slice(lastIndex);

  if (isGenerating) {
    const unclosedMatch = remainingText.match(/```(\w*)\n?([\s\S]*)$/);
    if (unclosedMatch) {
      const beforeCode = remainingText.slice(0, unclosedMatch.index);
      if (beforeCode) parts.push({ type: 'text', content: beforeCode });
      parts.push({ type: 'code', lang: unclosedMatch[1] || '', content: unclosedMatch[2] });
      remainingText = '';
    }
  }

  if (remainingText) parts.push({ type: 'text', content: remainingText });

  return { sources, parts };
}

// 💎 INLINE CODE DIFF COMPONENT (Cursor / Antigravity Style as a Tab/Accordion)
interface CodeBlockProps {
  id: string;
  statusMap: Record<string, 'pending' | 'accepted' | 'rejected'>;
  setStatusMap: React.Dispatch<React.SetStateAction<Record<string, 'pending' | 'accepted' | 'rejected'>>>;
  lang: string;
  code: string;
  activeFile: string | null;  // ✨ ADDED
  openUpwards?: boolean;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ id, statusMap, setStatusMap, lang, code, activeFile, openUpwards = false }) => {
  const { t } = useI18n();
  const status = statusMap[id] || 'pending';
  const [isExpanded, setIsExpanded] = useState(false);
  const lines = code.split('\n');

  const isDiff = lines.some(l => l.startsWith('+ ') || l.startsWith('- ') || l.startsWith('@@ '));
  const addedLinesCount = lines.filter(l => l.startsWith('+ ') || l.startsWith('++')).length;
  const removedLinesCount = lines.filter(l => l.startsWith('- ') || l.startsWith('--')).length;

  const handleAccept = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStatusMap(prev => ({ ...prev, [id]: 'accepted' }));
  };

  const handleReject = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStatusMap(prev => ({ ...prev, [id]: 'rejected' }));
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = document.createElement('textarea');
    el.value = code;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  };

  return (
    <div className="code-block-container" style={{
      margin: '0 0', borderRadius: '12px', overflow: 'hidden',
      border: `1px solid ${status === 'accepted' ? 'rgba(34, 197, 94, 0.4)' : status === 'rejected' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255,255,255,0.1)'}`,
      background: '#0d0d0f', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      transition: 'all 0.3s ease',
      display: 'flex',
      flexDirection: openUpwards ? 'column-reverse' : 'column' // ✨ Flex Trick: Renders body upwards
    }}>
      {/* Tab Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', background: 'rgba(255,255,255,0.05)',
          borderBottom: (!openUpwards && isExpanded) ? '1px solid rgba(255,255,255,0.05)' : 'none',
          borderTop: (openUpwards && isExpanded) ? '1px solid rgba(255,255,255,0.05)' : 'none',
          cursor: 'pointer', transition: 'background 0.2s'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <motion.div animate={{ rotate: isExpanded ? (openUpwards ? -90 : 90) : 0 }} transition={{ duration: 0.2 }}>
            <ChevronRight size={16} color="#a1a1aa" />
          </motion.div>
          <Code size={14} color="#a1a1aa" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#d4d4d8', fontWeight: 600, letterSpacing: '0.3px' }}>
              {isDiff ? t('aiPanel.suggestedChanges') : t('aiPanel.codeBlock')} <span style={{ opacity: 0.5, fontSize: '11px', textTransform: 'uppercase' }}>({lang || 'TEXT'})</span>
            </span>

            {isDiff && (
              <div style={{ display: 'flex', gap: '4px', marginLeft: '4px' }}>
                {addedLinesCount > 0 && (
                  <span style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#4ade80', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>
                    +{addedLinesCount}
                  </span>
                )}
                {removedLinesCount > 0 && (
                  <span style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>
                    -{removedLinesCount}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleCopy} style={{ background: 'transparent', color: '#a1a1aa', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '4px 8px', borderRadius: '6px' }}>
            <Copy size={12} /> {t('aiPanel.copy')}
          </button>

          {status === 'pending' && (
            <>
              <button onClick={handleReject} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '4px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }}>
                <X size={12} /> {t('aiPanel.dismiss')}
              </button>
              <button onClick={handleAccept} style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#86efac', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '6px', padding: '4px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }}>
                <Check size={12} /> {t('aiPanel.apply')}
              </button>
            </>
          )}
          {status === 'accepted' && <span style={{ fontSize: '11px', color: '#4ade80', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}><CheckCircle2 size={12} /> {t('aiPanel.applied')}</span>}
          {status === 'rejected' && <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}><X size={12} /> {t('aiPanel.dismissed')}</span>}
        </div>
      </div>

      {/* Expandable Body */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '14px', overflowX: 'auto', overflowY: 'auto', maxHeight: '350px', fontSize: '13px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', lineHeight: '1.6', color: '#e4e4e7', background: 'rgba(0,0,0,0.3)' }}>
              {lines.map((line, i) => {
                let bg = 'transparent';
                let col = '#e4e4e7';
                let prefix = '  ';
                let isSpecial = false;

                if (isDiff) {
                  if (line.startsWith('+ ') || line.startsWith('++')) {
                    bg = 'rgba(34, 197, 94, 0.15)'; col = '#86efac'; prefix = '+ '; line = line.substring(2); isSpecial = true;
                  } else if (line.startsWith('- ') || line.startsWith('--')) {
                    bg = 'rgba(239, 68, 68, 0.15)'; col = '#fca5a5'; prefix = '- '; line = line.substring(2); isSpecial = true;
                  } else if (line.startsWith('@@')) {
                    bg = 'rgba(59, 130, 246, 0.1)'; col = '#93c5fd'; prefix = '  '; isSpecial = true;
                  }
                }

                return (
                  <div key={i} style={{ background: bg, color: col, display: 'flex', padding: '0 4px', borderRadius: '4px', opacity: (isDiff && !isSpecial && line.trim() === '') ? 0.5 : 1 }}>
                    {isDiff && <span style={{ width: '24px', flexShrink: 0, opacity: 0.5, userSelect: 'none', color: col }}>{prefix}</span>}
                    <span style={{ whiteSpace: 'pre' }}>{line}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// 💎 Main function: Renders everything in ONE unified Box
const renderAssistantMessage = (
  text: string,
  messageIndex: number,
  activeFile: string | null,
  isGenerating: boolean,
  isLastMsg: boolean,
  actionsNode: React.ReactNode,
  onOpenLink: (url: string) => void,
  tr: (key: string) => string
) => {

  // ✨ Parse and extract sources from the text
  const { sources, parts } = parseAssistantContent(text, isGenerating);

  // Pre-calculate visible text blocks to avoid rendering empty elements
  const getVisibleText = (txt: string) => {
    if (isGenerating) return txt;
    return txt.split('\n').filter(l => !l.match(/^\[(.*?)\](.*)/)).join('\n').trim();
  };

  const validParts = parts.filter(p => p.type === 'code' || getVisibleText(p.content).length > 0);

  return (
    <div style={{
      background: 'rgba(24, 24, 27, 0.65)',
      border: '1px solid rgba(168, 85, 247, 0.25)',
      borderRadius: '16px',
      padding: '16px 20px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      width: '100%'
    }}>

      {/* Fallback for when there is no text initially */}
      {validParts.length === 0 && <div style={{ display: 'flex' }}><span style={{ color: '#a1a1aa', fontSize: '13px', fontStyle: 'italic' }}>{tr('aiPanel.processing')}</span></div>}

      {/* 1. All Message Text and Historical Code Blocks */}
      {validParts.map((part, idx) => {
        if (part.type === 'text') {
          return <div key={idx}>{formatCognitiveMessage(part.content, isGenerating)}</div>;
        } else {
          // Hide code blocks if it's the last message (they will render in the dock below)
          if (!isLastMsg) {
            return <CodeBlock key={idx} id={`hist-${messageIndex}-${idx}`} statusMap={{}} setStatusMap={() => { }} lang={part.lang!} code={part.content} activeFile={activeFile} openUpwards={false} />;
          }
          return null;
        }
      })}

      {/* 2. Sources Section (Appears after all text) */}
      {sources.length > 0 && !isGenerating && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '4px' }}>
          <div style={{ width: '100%', fontSize: '11px', color: '#a1a1aa', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe size={12} /> {tr('aiPanel.sources')}
          </div>
          {sources.map((src, i) => (
            <div
              key={i}
              title={src.url}
              onClick={(e) => { e.preventDefault(); onOpenLink(src.url); }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(src.url, '_blank');
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
                fontSize: '11px', color: '#60a5fa', cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'; e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            >
              <Globe size={12} color="#60a5fa" />
              {extractDomain(src.url)}
            </div>
          ))}
        </div>
      )}

      {/* 3. Action Buttons Section (Always at the very bottom) */}
      <div style={{ display: 'flex', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '4px' }}>
        {actionsNode}
      </div>
    </div>
  );
};

interface AIPanelProps {
  activeFile: string | null;
  currentContent: string;
  onFileSelect?: (path: string) => void;
  onMissionUpdate?: (name: string) => void;
  onRefreshExplorer?: () => void;
  onOpenKavosh?: (url: string) => void;
  onOpenEditorTerminalTab?: (opts?: { aiStatus?: string }) => void;
  onOpenEditorAgentTab?: (opts?: { aiStatus?: string }) => void;
  onOpenEditorDownloadTab?: (opts?: { initialUrl?: string; aiStatus?: string }) => void;
  onProposals?: (proposals: { fileName: string; original: string; proposed: string }[]) => void;
  onMissionDiffZone?: (proposal: { fileName: string; original: string; proposed: string } | null) => void;
}

const AIPanel: React.FC<AIPanelProps> = ({
  activeFile, currentContent, onFileSelect, onMissionUpdate,
  onRefreshExplorer, onOpenKavosh, onOpenEditorTerminalTab, onOpenEditorDownloadTab,
  onProposals, onMissionDiffZone
}) => {
  const { t } = useI18n();
  const MODE_CONFIG = useMemo((): Record<FA7Mode, { label: string; icon: React.ReactNode; color: string; desc: string }> => ({
    agent: { label: t('mode.pilot'), icon: <Zap size={12} />, color: '#a855f7', desc: t('mode.pilotDesc') },
    plan: { label: t('mode.architect'), icon: <Sparkles size={12} />, color: '#10b981', desc: t('mode.architectDesc') },
    debug: { label: t('mode.medic'), icon: <Activity size={12} />, color: '#ef4444', desc: t('mode.medicDesc') },
    ask: { label: t('mode.oracle'), icon: <Search size={12} />, color: '#f59e0b', desc: t('mode.oracleDesc') },
    gather: { label: t('mode.gather'), icon: <BookOpen size={12} />, color: '#06b6d4', desc: t('mode.gatherDesc') }
  }), [t]);
  const [prompt, setPrompt] = useState('');
  const sendMessageRef = useRef<(textOverride?: string) => Promise<void>>(async () => {});
  const [lastMermaidFlowchart, setLastMermaidFlowchart] = useState<string>('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const messagesLenRef = useRef(0);
  useEffect(() => { messagesLenRef.current = messages.length; }, [messages]);
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState('mistral');
  const [isManualModel, setIsManualModel] = useState(false);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<string[]>([]);

  const MENTION_PROVIDERS = useMemo(() => [
    { id: 'git', label: 'Git Diff', icon: '📋' },
    { id: 'codebase', label: 'Codebase Map', icon: '🗺️' },
    { id: 'symbol', label: 'Symbols', icon: '🔎' },
    { id: 'folder', label: 'Project Folder', icon: '📁' },
    { id: 'web', label: 'Web Search', icon: '🌐' },
    { id: 'terminal', label: 'Terminal Output', icon: '💻' },
    { id: 'problems', label: 'Problems', icon: '⚠️' },
    { id: 'docs', label: 'Docs', icon: '📚' },
  ], []);

  useEffect(() => {
    if (mentionSearch === null) { setSearchResults([]); return; }
    const q = mentionSearch.toLowerCase();
    const providerHits = MENTION_PROVIDERS
      .filter((p) => p.label.toLowerCase().includes(q) || p.id.includes(q))
      .map((p) => `@${p.id}`);
    Promise.all([
      axios.get(`${API_BASE}/v3/files/search`, { params: { q: mentionSearch } }).catch(() => ({ data: [] })),
      axios.get(`${API_BASE}/v3/symbols/search`, { params: { q: mentionSearch } }).catch(() => ({ data: { results: [] } }))
    ]).then(([fr, sr]) => {
      const files = Array.isArray(fr.data) ? fr.data : (fr.data?.results || []);
      const symbols = (sr.data?.results || []).map((s: any) => `@symbol:${s.id}`);
      setSearchResults([...providerHits, ...symbols, ...files].slice(0, 15));
    }).catch(() => setSearchResults(providerHits));
  }, [mentionSearch, MENTION_PROVIDERS]);

  useEffect(() => {
    const q = prompt.trim();
    if (q.length < 3) {
      setMatchedSkills([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const r = await axios.get(`${API_BASE}/v3/skills/match`, { params: { q } });
        setMatchedSkills(r.data?.skills || []);
      } catch {
        setMatchedSkills([]);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [prompt]);

  const selectMention = useCallback(async (item: string) => {
    const val = prompt;
    const lastAtIdx = val.lastIndexOf('@');
    const before = lastAtIdx >= 0 ? val.slice(0, lastAtIdx) : val;
    setPrompt(before.trimEnd());
    setMentionSearch(null);

    if (item === '@git') {
      try {
        const r = await axios.get(`${API_BASE}/v3/context/git-diff`);
        setContextFiles((prev) => [...prev.filter((f) => f.path !== '@git-diff'), {
          path: '@git-diff',
          content: r.data?.diff || '(no git changes)'
        }]);
      } catch { /* ignore */ }
      return;
    }
    if (item === '@codebase') {
      try {
        const q = before.trim() || prompt.trim();
        const r = await axios.post(`${API_BASE}/ai/hybrid-search`, { query: q, topK: 8 });
        const merged = r.data?.merged || [];
        const body = merged.length
          ? ('## Codebase (hybrid RAG)\n' + merged.map((h: { path: string; score?: number; text?: string }) =>
            `### ${h.path}${h.score != null ? ` (${Number(h.score).toFixed(2)})` : ''}\n${h.text || ''}`).join('\n\n'))
          : ((await axios.get(`${API_BASE}/ai/repo-map`, { params: { q } })).data?.map || '');
        setContextFiles((prev) => [...prev.filter((f) => f.path !== '@codebase'), {
          path: '@codebase',
          content: body || '(no matches)'
        }]);
      } catch { /* ignore */ }
      return;
    }
    if (item === '@symbol') {
      try {
        const r = await axios.get(`${API_BASE}/v3/symbols/search`, { params: { q: prompt } });
        const results = r.data?.results || [];
        const blocks: string[] = [];
        for (const s of results.slice(0, 6)) {
          const ctx = await axios.get(`${API_BASE}/v3/symbols/context`, { params: { id: s.id } }).catch(() => null);
          if (ctx?.data?.snippet) {
            blocks.push(`### ${s.symbol} @ ${s.path}:${s.line}\n` + ctx.data.snippet);
          }
        }
        setContextFiles((prev) => [...prev.filter((f) => f.path !== '@symbols'), {
          path: '@symbols',
          content: blocks.length ? ('## Symbols\n' + blocks.join('\n\n')) : '(no matches)'
        }]);
      } catch { /* ignore */ }
      return;
    }
    if (item === '@folder') {
      try {
        const r = await axios.post(`${API_BASE}/v3/files/attach-folder-from-path`, {
          path: (await axios.get(`${API_BASE}/v3/project/path`)).data?.path,
          maxFiles: 30
        });
        const files = r.data?.files || [];
        for (const f of files.slice(0, 20)) {
          setContextFiles((prev) => {
            if (prev.some((x) => x.path === f.path)) return prev;
            return [...prev, { path: f.path, content: f.content || '' }];
          });
        }
      } catch { /* ignore */ }
      return;
    }
    if (item === '@web') {
      const q = before.trim() || 'project documentation';
      try {
        const r = await axios.post(`${API_BASE}/v3/web/search`, { query: q, limit: 5 });
        const snippets = (r.data?.results || []).map((x: { title?: string; snippet?: string }) =>
          `${x.title || ''}\n${x.snippet || ''}`).join('\n\n');
        setContextFiles((prev) => [...prev.filter((f) => f.path !== '@web'), {
          path: '@web',
          content: snippets || '(no web results)'
        }]);
      } catch { /* ignore */ }
      return;
    }
    if (item === '@terminal') {
      try {
        const win = window as unknown as {
          __fa7TerminalSelection?: string;
          __fa7TerminalBuffer?: string;
        };
        const sel = win.__fa7TerminalSelection || '';
        const buf = win.__fa7TerminalBuffer || '';
        const sessionId = localStorage.getItem(AGENT_TERMINAL_SESSION_KEY) || '';
        const r = await axios.get(`${API_BASE}/v3/context/terminal`, {
          params: {
            sessionId,
            selection: sel,
            buffer: buf,
            purpose: 'all'
          }
        });
        setContextFiles((prev) => [...prev.filter((f) => f.path !== '@terminal'), {
          path: '@terminal',
          content: r.data?.content || sel || buf || '(no terminal output)'
        }]);
      } catch { /* ignore */ }
      return;
    }
    if (item === '@problems') {
      try {
        const r = await axios.get(`${API_BASE}/v3/context/problems`, {
          params: { runLint: '1' }
        });
        setContextFiles((prev) => [...prev.filter((f) => f.path !== '@problems'), {
          path: '@problems',
          content: r.data?.content || '(no problems found)'
        }]);
      } catch { /* ignore */ }
      return;
    }
    if (item === '@docs') {
      const q = before.trim() || prompt.trim();
      try {
        const r = await axios.get(`${API_BASE}/v3/context/docs`, { params: { q } });
        setContextFiles((prev) => [...prev.filter((f) => f.path !== '@docs'), {
          path: '@docs',
          content: r.data?.content || '(no documentation found)'
        }]);
      } catch { /* ignore */ }
      return;
    }

    if (item.startsWith('@symbol:')) {
      try {
        const id = item.slice('@symbol:'.length);
        const r = await axios.get(`${API_BASE}/v3/symbols/context`, { params: { id } });
        setContextFiles((prev) => [...prev, { path: `@symbol:${id}`, content: r.data?.snippet || '' }]);
      } catch { /* ignore */ }
      return;
    }

    const relPath = item.replace(/^@/, '');
    try {
      const r = await axios.get(`${API_BASE}/v3/files/content`, { params: { path: relPath } });
      setContextFiles((prev) => {
        if (prev.some((f) => f.path === relPath)) return prev;
        return [...prev, { path: relPath, content: r.data?.content || '' }];
      });
    } catch { /* ignore */ }
  }, [prompt, MENTION_PROVIDERS]);
  const [mode, setMode] = useState<FA7Mode>('agent');
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  const [notebookModalOpen, setNotebookModalOpen] = useState(false);
  const [notebookContent, setNotebookContent] = useState('');
  const [notebookDraft, setNotebookDraft] = useState('');
  const [notebookPath, setNotebookPath] = useState('');
  const [notebookExists, setNotebookExists] = useState(false);
  const [modelWarning, setModelWarning] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // ✨ GLOBAL CODE BLOCK STATE
  const [codeStatuses, setCodeStatuses] = useState<Record<string, 'pending' | 'accepted' | 'rejected'>>({});
  const diffZoneRef = useRef<{ fileName: string; original: string; proposed: string } | null>(null);

  const [loadingModelInfo, setLoadingModelInfo] = useState<{
    name: string; route: 'online' | 'offline'; allowedTooltip?: string;
  } | null>(null);
  const [thinkingState, setThinkingState] = useState('');

  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const [vaultModalOpen, setVaultModalOpen] = useState(false);
  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const [vaultItems, setVaultItems] = useState<Record<string, string>>({});
  const [newVaultKey, setNewVaultKey] = useState('');
  const [newVaultVal, setNewVaultVal] = useState('');

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    index: number;
    msg: ChatMsg;
  } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const speechRecognitionRef = useRef<any | null>(null);
  /** Snapshot of `prompt` when a voice session starts; finals accumulate separately. */
  const voiceBaseRef = useRef('');
  const voiceFinalTranscriptRef = useRef('');
  const isListeningRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [attachPickerOpen, setAttachPickerOpen] = useState(false);
  const attachPickerRef = useRef<HTMLDivElement | null>(null);
  const chatDropZoneRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const dragCounter = useRef(0);

  const [currentMission, setCurrentMission] = useState<{ name?: string; plan: any; steps: any[]; status: string } | null>(null);
  const [pendingPlanImplement, setPendingPlanImplement] = useState(false);
  const [checkpointTimeline, setCheckpointTimeline] = useState<Array<{ id: string; label: string; files: string[]; at: string; messageIndex?: number }>>([]);
  const [matchedSkills, setMatchedSkills] = useState<Array<{ id: string; name: string; description?: string }>>([]);
  const [missionHistory, setMissionHistory] = useState<any[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [isTemporaryChat, setIsTemporaryChat] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const previousSessionBeforeTemporaryRef = useRef<string | null>(null);

  const setChatStreaming = useHooshStore((s) => s.setChatStreaming);

  const processAssistantFa7Actions = useCallback(async (wasAborted: boolean) => {
    if (wasAborted) return;

    let assistantContent = '';
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant') assistantContent = last.content;
      return prev;
    });
    if (!assistantContent.trim()) return;

    const cleaned = stripFa7ActionTags(assistantContent);
    if (cleaned !== assistantContent.trim()) {
      setMessages((prev) => {
        const next = [...prev];
        const li = next.length - 1;
        if (li >= 0 && next[li]?.role === 'assistant') {
          next[li] = { role: 'assistant', content: cleaned };
        }
        return next;
      });
    }

    // Agent/plan/debug with an open project use kernel mission loop (TOOL:), not FA7 tags.
    if (mode === 'agent' || mode === 'plan' || mode === 'debug') return;

    await runFa7ActionsFromAssistant(assistantContent, {
      apiBase: API_BASE,
      mode,
      onProposals,
      onOpenKavosh,
      onOpenTerminal: onOpenEditorTerminalTab,
      onOpenDownload: onOpenEditorDownloadTab,
      onFileSelect,
      onRefreshExplorer,
      appendSystemInfo: (message) => {
        setMessages((prev) => [...prev, { role: 'system_info', content: message }]);
      }
    });
  }, [mode, onProposals, onOpenKavosh, onOpenEditorTerminalTab, onOpenEditorDownloadTab, onFileSelect, onRefreshExplorer]);

  const handleOpenLink = useCallback((url: string) => {
    if (onOpenKavosh) onOpenKavosh(url);
    else window.open(url, '_blank');
  }, [onOpenKavosh]);

  const createSessionId = () => `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const deriveSessionTitle = (msgs: ChatMsg[]) => {
    const firstUser = msgs.find((m) => m.role === 'user');
    if (!firstUser?.content) return 'New Chat';
    const t = firstUser.content.replace(/\s+/g, ' ').trim();
    return t.length > 48 ? t.slice(0, 48) + '…' : t;
  };

  const persistSessions = (sessions: ChatSession[]) => {
    const stable = sessions.filter((s) => !s.temporary).slice(0, 50);
    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(stable));
  };

  const loadNotebook = useCallback(async (interactive = false): Promise<boolean> => {
    try {
      const st = await axios.get(`${API_BASE}/notebook/status`);
      const exists = !!st.data?.exists;
      const p = String(st.data?.path || '');
      setNotebookPath(p);
      setNotebookExists(exists);
      if (!exists) {
        setNotebookContent('');
        setNotebookDraft('');
        if (interactive) {
          const ok = window.confirm('Notebook does not exist. Create one now?');
          if (!ok) return false;
          const created = await axios.post(`${API_BASE}/notebook/create`);
          if (created.data?.ok) {
            setNotebookExists(true);
            setNotebookPath(String(created.data?.path || p));
            const c = String(created.data?.content || '');
            setNotebookContent(c);
            setNotebookDraft(c);
            return true;
          }
          return false;
        }
        return false;
      }
      const r = await axios.get(`${API_BASE}/notebook/read?autocreate=0`);
      if (r.data?.ok) {
        const c = String(r.data.content || '');
        setNotebookContent(c);
        setNotebookDraft(c);
        setNotebookExists(true);
        setNotebookPath(String(r.data?.path || p));
        return true;
      }
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setNotebookExists(false);
        setNotebookContent('');
        setNotebookDraft('');
      }
    }
    return false;
  }, []);

  const saveNotebookDraft = async () => {
    try {
      const r = await axios.post(`${API_BASE}/notebook/update`, { content: notebookDraft });
      if (r.data?.ok) setNotebookContent(notebookDraft);
    } catch { /* ignore */ }
  };

  const createNotebookNow = async () => {
    try {
      const r = await axios.post(`${API_BASE}/notebook/create`);
      if (r.data?.ok) {
        const c = String(r.data.content || '');
        setNotebookExists(true);
        setNotebookPath(String(r.data?.path || ''));
        setNotebookContent(c);
        setNotebookDraft(c);
      }
    } catch { /* ignore */ }
  };

  const deleteNotebookNow = async () => {
    const ok = window.confirm('Delete notebook? This cannot be undone.');
    if (!ok) return;
    try {
      const r = await axios.delete(`${API_BASE}/notebook/delete`);
      if (r.data?.ok) {
        setNotebookExists(false);
        setNotebookContent('');
        setNotebookDraft('');
      }
    } catch { /* ignore */ }
  };

  const makeEmptySession = (forcedId?: string, temporary = false): ChatSession => {
    const now = new Date().toISOString();
    return {
      id: forcedId || createSessionId(),
      title: 'New Chat', createdAt: now, updatedAt: now, mode, messages: [],
      currentMission: null, pinned: false, temporary
    };
  };

  useEffect(() => {
    const closeContextMenu = () => setContextMenu(null);
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeContextMenu(); };
    document.addEventListener('click', closeContextMenu);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('click', closeContextMenu);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent, index: number, msg: ChatMsg) => {
    e.preventDefault();
    let x = e.clientX;
    let y = e.clientY;
    if (x + 180 > window.innerWidth) x = window.innerWidth - 180;
    if (y + 150 > window.innerHeight) y = window.innerHeight - 150;
    setContextMenu({ x, y, index, msg });
  };

  const deleteSingleMessage = (index: number) => {
    setMessages(prev => prev.filter((_, i) => i !== index));
    setContextMenu(null);
  };

  // ✨ Clean Text for Clipboard
  const handleCopyMessage = (text: string, index: number) => {
    const cleanText = text
      .split('\n')
      .filter(line => !line.match(/^\[(reading|thinking|planning|searching|executing|writing|rewriting|done|ask|error)\]/i))
      .join('\n')
      .replace(/---SOURCES_START---\n?([\s\S]*?)\n?---SOURCES_END---/g, '\nSources:\n$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const textArea = document.createElement("textarea");
    textArea.value = cleanText;
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    } finally {
      document.body.removeChild(textArea);
      setContextMenu(null);
    }
  };

  /** Polish grammar / spelling / flow via companion → Ollama (`mode: 'ask'` skips mission routing). */
  const polishUserText = async () => {
    if (!prompt.trim() || isEnhancing) return;
    setIsEnhancing(true);
    setPolishError(null);
    const controller = new AbortController();

    const prefs = readModelPrefs();
    const eligible = computeEligibleModels(prefs, models);
    let allowedModels = eligible.map((m: { name: string }) => String(m.name)).filter(Boolean);
    if (allowedModels.length === 0 && models.length > 0) {
      allowedModels = models.map((m: { name?: string }) => String(m.name || '')).filter(Boolean);
    }
    if (allowedModels.length === 0 && selectedModel) {
      allowedModels = [selectedModel];
    }
    const modelName =
      eligible.length > 0 ? canonicalizeModelToEligible(selectedModel, eligible) : String(selectedModel || 'mistral').trim();

    const systemPolish =
      'You are a writing assistant. Fix grammar, spelling, and improve sentence flow and clarity. Preserve the original meaning and language (do not translate). Output ONLY the revised text with no preamble, quotes, or explanation.';

    let accumulated = '';
    let sawStreamError = false;

    try {
      await runChatStream(
        {
          messages: [
            { role: 'system', content: systemPolish },
            { role: 'user', content: prompt.trim() }
          ],
          stream: true,
          model: modelName,
          mode: 'ask',
          allowedModels
        },
        {
          signal: controller.signal,
          onLine: ({ text, agentEvent }) => {
            if (agentEvent?.type === 'error') {
              sawStreamError = true;
              const msg = typeof agentEvent.message === 'string' ? agentEvent.message : 'Polish failed.';
              setPolishError(msg);
              return;
            }
            if (agentEvent?.type === 'status') return;
            if (text) accumulated += text;
          }
        }
      );
      const out = accumulated.trim();
      if (out) setPrompt(out);
      else if (!sawStreamError) {
        setPolishError('No text returned. Is Ollama running and a model selected?');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setPolishError(msg);
      console.error('Polish error:', error);
    } finally {
      setIsEnhancing(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('fa7_missions');
    if (saved) setMissionHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    try {
      const rawSessions = localStorage.getItem(CHAT_SESSIONS_KEY);
      const rawActive = localStorage.getItem(ACTIVE_CHAT_SESSION_KEY);
      const parsed = rawSessions ? JSON.parse(rawSessions) : [];
      const sessions: ChatSession[] = (Array.isArray(parsed) ? parsed : []).map((s: any) => ({
        id: String(s?.id || createSessionId()),
        title: String(s?.title || 'New Chat'),
        createdAt: String(s?.createdAt || new Date().toISOString()),
        updatedAt: String(s?.updatedAt || s?.createdAt || new Date().toISOString()),
        mode: (s?.mode || 'agent') as FA7Mode,
        messages: Array.isArray(s?.messages) ? s.messages : [],
        currentMission: s?.currentMission || null,
        pinned: !!s?.pinned, temporary: false
      }));

      if (sessions.length === 0) {
        const initial = makeEmptySession();
        setChatSessions([initial]);
        setActiveSessionId(initial.id);
        setIsTemporaryChat(false);
        setMessages([]);
        setCurrentMission(null);
        persistSessions([initial]);
        localStorage.setItem(ACTIVE_CHAT_SESSION_KEY, initial.id);
        return;
      }
      setChatSessions(sessions);
      const active = sessions.find((s) => s.id === rawActive) || sessions[0];
      setActiveSessionId(active.id);
      setIsTemporaryChat(false);
      setMessages(Array.isArray(active.messages) ? active.messages : []);
      setCurrentMission(active.currentMission || null);
      if (active.mode) setMode(active.mode);
      localStorage.setItem(ACTIVE_CHAT_SESSION_KEY, active.id);
    } catch {
      const fallback = makeEmptySession();
      setChatSessions([fallback]);
      setActiveSessionId(fallback.id);
      setIsTemporaryChat(false);
      setMessages([]);
      setCurrentMission(null);
      persistSessions([fallback]);
      localStorage.setItem(ACTIVE_CHAT_SESSION_KEY, fallback.id);
    }
  }, []);

  useEffect(() => {
    if (!activeSessionId || isTemporaryChat) return;
    setChatSessions((prev) => {
      const now = new Date().toISOString();
      const next = prev.map((s) => s.id === activeSessionId
        ? { ...s, mode, messages, currentMission, updatedAt: now, title: deriveSessionTitle(messages) }
        : s
      );
      persistSessions(next);
      localStorage.setItem(ACTIVE_CHAT_SESSION_KEY, activeSessionId);
      return next;
    });
  }, [messages, currentMission, mode, activeSessionId, isTemporaryChat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    setChatStreaming(isLoading);
  }, [isLoading, setChatStreaming]);

  const loadVault = useCallback(async () => {
    const normalize = (raw: unknown): Record<string, string> => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        out[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
      return out;
    };
    try {
      const res = await axios.get(`${API_BASE}/v3/vault`);
      if (res.data?.ok && res.data.entries && typeof res.data.entries === 'object') {
        const entries = normalize(res.data.entries);
        setVaultItems(entries);
        try {
          localStorage.setItem('fa7_os_vault', JSON.stringify(entries));
        } catch { /* ignore */ }
        return;
      }
    } catch { /* offline or companion down */ }
    try {
      const localVault = localStorage.getItem('fa7_os_vault');
      if (localVault) setVaultItems(normalize(JSON.parse(localVault)));
    } catch { /* ignore */ }
  }, []);

  const persistVaultRemote = async (entries: Record<string, string>) => {
    try {
      await axios.put(`${API_BASE}/v3/vault`, { entries });
      try {
        localStorage.setItem('fa7_os_vault', JSON.stringify(entries));
      } catch { /* ignore */ }
    } catch {
      try {
        localStorage.setItem('fa7_os_vault', JSON.stringify(entries));
      } catch { /* ignore */ }
    }
  };

  const saveVaultEntry = async () => {
    if (!newVaultKey.trim() || !newVaultVal.trim()) return;
    const updated = { ...vaultItems, [newVaultKey]: newVaultVal };
    setVaultItems(updated);
    setNewVaultKey('');
    setNewVaultVal('');
    await persistVaultRemote(updated);
  };

  const deleteVaultEntry = async (key: string) => {
    const updated = { ...vaultItems };
    delete updated[key];
    setVaultItems(updated);
    await persistVaultRemote(updated);
  };

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await axios.get(`${API_BASE}/ai/models/catalog`);
        const rows = Array.isArray(res.data?.models) ? res.data.models : [];
        if (rows.length > 0) {
          setModels(rows);
          setSelectedModel((prev) => {
            if (prev && rows.some((m: any) => String(m?.name || '') === prev)) return prev;
            const preferredInstalled = rows.find((m: any) => m?.installed)?.name;
            return String(preferredInstalled || rows[0]?.name || 'mistral');
          });
        }
      } catch (err) { }
    };
    fetchModels();
    loadVault();
  }, [loadVault]);

  useEffect(() => {
    if (!isLoading) {
      setThinkingState('');
      return;
    }
    const states = ['🧠 Cognitive stream active...', '🌐 Synthesizing data...', '📂 Analyzing workspace...', '⚙️ Planning execution...'];
    let idx = 0;
    setThinkingState(states[0]);
    const timer = setInterval(() => {
      idx = (idx + 1) % states.length;
      setThinkingState(states[idx]);
    }, 2800);
    return () => clearInterval(timer);
  }, [isLoading]);

  useEffect(() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!Ctor);
    return () => { try { speechRecognitionRef.current?.stop?.(); } catch { /* ignore */ } };
  }, []);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    if (!attachPickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (attachPickerRef.current && !attachPickerRef.current.contains(e.target as Node)) {
        setAttachPickerOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAttachPickerOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [attachPickerOpen]);

  useLayoutEffect(() => {
    const el = folderInputRef.current;
    if (!el) return;
    try {
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
    } catch {
      /* ignore */
    }
  }, []);

  const openNotebookManager = async () => {
    await loadNotebook(false);
    setNotebookModalOpen(true);
  };

  const togglePinSession = (sessionId: string) => {
    setChatSessions((prev) => {
      const next = prev.map((s) =>
        s.id === sessionId ? { ...s, pinned: !s.pinned, updatedAt: new Date().toISOString() } : s
      );
      persistSessions(next);
      return next;
    });
  };

  const filteredSortedSessions = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return [...chatSessions]
      .filter((s) => !q || (s.title || '').toLowerCase().includes(q))
      .sort((a, b) => {
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
      });
  }, [chatSessions, historyQuery]);

  const checkModel = async (name: string) => {
    try {
      const prefs = readModelPrefs();
      const eligible = computeEligibleModels(prefs, models);
      if (!eligible.some((m: any) => ollamaNamesCompatible(name, String(m?.name || '')))) {
        setModelWarning(t('aiPanel.modelDisabled').replace('{name}', name));
        return;
      }
    } catch { }
  };

  useEffect(() => { if (selectedModel) checkModel(selectedModel); }, [selectedModel, models, t]);

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      const streamId = (window as unknown as { __fa7LastStreamId?: string }).__fa7LastStreamId;
      axios.post(`${API_BASE}/ai/chat/abort`, streamId ? { streamId } : {}).catch(() => {});
      setIsLoading(false);
      setLoadingModelInfo(null);
      setCurrentMission((prev) => prev ? { ...prev, status: t('aiPanel.missionAborted') } : null);
      setMessages((prev) => [...prev, { role: 'system_info', content: t('aiPanel.missionAbortedMsg') }]);
    }
  };

  const handleAbortAll = () => {
    stopGeneration();
    useHooshStore.getState().abortMission();
  };

  const toggleVoiceInput = () => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      window.alert('Voice input is not supported in this browser.');
      return;
    }
    if (isListening) {
      isListeningRef.current = false;
      try {
        speechRecognitionRef.current?.stop?.();
      } catch {
        /* ignore */
      }
      setIsListening(false);
      speechRecognitionRef.current = null;
      return;
    }

    voiceBaseRef.current = prompt;
    voiceFinalTranscriptRef.current = '';

    const rec = new Ctor();
    speechRecognitionRef.current = rec;
    const hasPersian = /[\u0600-\u06FF]/.test(prompt);
    rec.lang = hasPersian ? 'fa-IR' : 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    const mergeDisplay = (interim: string) => {
      const base = voiceBaseRef.current;
      const finals = voiceFinalTranscriptRef.current.trim();
      const parts = [base.trim(), finals].filter(Boolean);
      const core = parts.join(' ');
      if (!interim.trim()) return core;
      return core ? `${core} ${interim.trim()}` : interim.trim();
    };

    rec.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const seg = event.results[i];
        const txt = String(seg?.[0]?.transcript ?? '');
        if (seg.isFinal) {
          voiceFinalTranscriptRef.current += txt;
        } else {
          interim += txt;
        }
      }
      setPrompt(mergeDisplay(interim));
    };

    rec.onerror = (ev: Event & { error?: string }) => {
      const code = (ev as { error?: string }).error;
      if (code === 'no-speech' || code === 'audio-capture' || code === 'aborted') {
        return;
      }
      if (code === 'not-allowed') {
        window.alert('Microphone access was blocked. Allow mic permission for this app.');
      }
      isListeningRef.current = false;
      setIsListening(false);
      speechRecognitionRef.current = null;
    };

    rec.onend = () => {
      isListeningRef.current = false;
      setIsListening(false);
      speechRecognitionRef.current = null;
    };

    try {
      rec.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      speechRecognitionRef.current = null;
    }
  };

  const ingestDroppedOrSelectedFiles = useCallback((files: File[]) => {
    const MAX_FOLDER_FILES = 400;
    const list = files.length > MAX_FOLDER_FILES ? files.slice(0, MAX_FOLDER_FILES) : files;
    if (files.length > MAX_FOLDER_FILES) {
      setMessages((prev) => [...prev, { role: 'system_info', content: `⚠️ Only ${MAX_FOLDER_FILES} files attached.` }]);
    }
    list.forEach((file) => {
      const fAny = file as File & { webkitRelativePath?: string; path?: string };
      const label = fAny.webkitRelativePath?.trim() || (fAny.path ? fAny.path.replace(/^.*[/\\]/, '') || file.name : file.name);
      const reader = new FileReader();
      const isImage = file.type.startsWith('image/');
      reader.onload = (ev) => {
        const result = ev.target?.result;
        if (!result) return;
        if (isImage) setUploadedAssets((prev) => [...prev, { name: label, type: file.type, content: `[Image]`, dataUrl: result as string }]);
        else setUploadedAssets((prev) => [...prev, { name: label, type: file.type, content: result as string }]);
      };
      isImage ? reader.readAsDataURL(file) : reader.readAsText(file);
    });
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    ingestDroppedOrSelectedFiles(files);
    e.target.value = '';
  };

  useLayoutEffect(() => {
    const el = chatDropZoneRef.current;
    if (!el) return;

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      dragCounter.current++; setIsDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      dragCounter.current--;
      if (dragCounter.current === 0) setIsDragging(false);
    };
    const onDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const onDrop = (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      dragCounter.current = 0; setIsDragging(false);
      const files = fileListFromDataTransfer(e.dataTransfer);
      if (files.length > 0) {
        ingestDroppedOrSelectedFiles(files);
      } else {
        const urlOrText = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain');
        if (urlOrText) setPrompt(prev => prev + (prev.endsWith(' ') || !prev ? '' : ' ') + urlOrText);
      }
    };

    el.addEventListener('dragenter', onDragEnter, true);
    el.addEventListener('dragleave', onDragLeave, true);
    el.addEventListener('dragover', onDragOver, true);
    el.addEventListener('drop', onDrop, true);

    return () => {
      el.removeEventListener('dragenter', onDragEnter, true);
      el.removeEventListener('dragleave', onDragLeave, true);
      el.removeEventListener('dragover', onDragOver, true);
      el.removeEventListener('drop', onDrop, true);
    };
  }, [ingestDroppedOrSelectedFiles]);

  const removeUploadedAssetAt = (index: number) => setUploadedAssets((prev) => prev.filter((_, i) => i !== index));

  const insertPlanWorkflowPrompt = () => {
    setMode('plan');
    setPrompt((p) => (p.trim() ? `${p.trim()}\n\n` : '') + 'Outline a numbered plan and workflow for:\n\n');
    setAttachPickerOpen(false);
  };

  const insertCommentCodePrompt = () => {
    setMode('agent');
    setPrompt(
      (p) =>
        (p.trim() ? `${p.trim()}\n\n` : '') +
        'Add clear, concise code comments (explain intent and non-obvious choices). Apply to the active file and any @mentioned files.\n\n'
    );
    setAttachPickerOpen(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionSearch !== null) { if (e.key === 'Escape') setMentionSearch(null); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPrompt(val);
    if (polishError) setPolishError(null);
    const lastAtIdx = val.lastIndexOf('@');
    if (lastAtIdx !== -1 && lastAtIdx >= val.lastIndexOf(' ')) {
      const query = val.slice(lastAtIdx + 1);
      setMentionSearch(query);
    } else { setMentionSearch(null); }
  };

  const readBackendSessionMap = (): Record<string, string> => {
    try {
      const raw = localStorage.getItem(BACKEND_SESSION_MAP_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const writeBackendSessionMap = (map: Record<string, string>) => {
    localStorage.setItem(BACKEND_SESSION_MAP_KEY, JSON.stringify(map));
  };

  const ensureBackendSessionId = async (frontendId: string, title: string): Promise<string | null> => {
    if (isTemporaryChat) return null;
    const active = chatSessions.find((s) => s.id === frontendId);
    if (active?.backendSessionId) return active.backendSessionId;
    const map = readBackendSessionMap();
    if (map[frontendId]) {
      setChatSessions((prev) => prev.map((s) => s.id === frontendId ? { ...s, backendSessionId: map[frontendId] } : s));
      return map[frontendId];
    }
    try {
      const res = await axios.post(`${API_BASE}/v3/agent-sessions`, { title: title.slice(0, 120) || 'Chat' });
      const id = String(res.data?.session?.id || '');
      if (!id) return null;
      map[frontendId] = id;
      writeBackendSessionMap(map);
      setChatSessions((prev) => prev.map((s) => s.id === frontendId ? { ...s, backendSessionId: id } : s));
      try {
        localStorage.setItem(AGENT_TERMINAL_SESSION_KEY, id);
        await axios.post(`${API_BASE}/v3/terminals/agent-bind`, { sessionId: id });
      } catch { /* non-fatal */ }
      return id;
    } catch {
      return null;
    }
  };

  const syncAssistantToBackend = async (backendSessionId: string, content: string) => {
    if (!backendSessionId || !content.trim()) return;
    try {
      await axios.post(`${API_BASE}/v3/agent-sessions/${backendSessionId}/messages`, {
        message: { role: 'assistant', content: content.slice(0, 50000), at: new Date().toISOString() }
      });
    } catch { /* non-fatal */ }
  };

  const runAssistantStream = async (threadForApi: ChatMsg[], backendSessionId?: string | null) => {
    const prefs = readModelPrefs();
    const eligible = computeEligibleModels(prefs, models);
    let allowedModels = eligible.map((m: { name: string }) => String(m.name)).filter(Boolean);
    if (allowedModels.length === 0 && models.length > 0) {
      allowedModels = models.map((m: { name?: string }) => String(m.name || '')).filter(Boolean);
    }
    if (allowedModels.length === 0 && selectedModel) {
      allowedModels = [selectedModel];
    }

    const modelName =
      eligible.length > 0 ? canonicalizeModelToEligible(selectedModel, eligible) : String(selectedModel || 'mistral').trim();

    const systemBlock = buildHooshSystemBlock(mode, activeFile, currentContent, contextFiles);
    const apiMessages = chatThreadToApiMessages(threadForApi, systemBlock);

    const appendAssistantDelta = (delta: string) => {
      if (!delta) return;
      setMessages((prev) => {
        const next = [...prev];
        const li = next.length - 1;
        if (li >= 0 && next[li]?.role === 'assistant') {
          const cur = next[li] as { role: 'assistant'; content: string };
          next[li] = { role: 'assistant', content: cur.content + delta };
        }
        return next;
      });
      useHooshStore.getState().processStreamText(delta);
    };

    const signal = abortControllerRef.current?.signal;
    if (!signal) return;

    let useAcp = false;
    let acpBackend: string | undefined;
    if (mode === 'ask') {
      try {
        const acpRes = await axios.get(`${API_BASE}/v3/acp/backends`);
        if (acpRes.data?.useAcpForChat) {
          const backends = acpRes.data?.backends || [];
          const active = backends.find((b: { active?: boolean; enabled?: boolean }) => b.active && b.enabled);
          if (active?.id) {
            useAcp = true;
            acpBackend = String(active.id);
          }
        }
      } catch { /* default kernel route */ }
    }

    let assistantAccum = '';
    await runChatStream(
      {
        messages: apiMessages,
        stream: true,
        model: modelName,
        mode,
        allowedModels,
        sessionId: backendSessionId || undefined,
        useAcp,
        acpBackend
      },
      {
        signal,
        onStreamId: (id) => {
          (window as unknown as { __fa7LastStreamId?: string }).__fa7LastStreamId = id;
        },
        onLine: ({ text, agentEvent }) => {
          if (text) {
            assistantAccum += text;
            appendAssistantDelta(text);
          }
            if (agentEvent) {
            const raw = agentEvent as Record<string, unknown>;
            const evType = String(raw.type || '');
            if (evType === 'token' && raw.token) {
              const tok = String(raw.token);
              assistantAccum += tok;
              appendAssistantDelta(tok);
            }
            if (evType === 'finish' && typeof raw.message === 'string' && !assistantAccum.trim()) {
              assistantAccum = String(raw.message);
              appendAssistantDelta(assistantAccum);
            }
            if (evType === 'paused' && raw.planOnly) {
              setPendingPlanImplement(true);
            }
            if (evType === 'checkpoint') {
              setCheckpointTimeline((prev) => [...prev, {
                id: String(raw.id || ''),
                label: String(raw.label || 'checkpoint'),
                files: Array.isArray(raw.files) ? raw.files.map(String) : [],
                at: new Date().toISOString(),
                messageIndex: messagesLenRef.current
              }]);
            }
            if (evType === 'diffzone_start') {
              const fileName = String(raw.path || raw.fileName || '');
              if (fileName) {
                onFileSelect?.(fileName);
                diffZoneRef.current = {
                  fileName,
                  original: String(raw.original || ''),
                  proposed: ''
                };
                const proposal = {
                  fileName,
                  original: String(raw.original || ''),
                  proposed: ''
                };
                onMissionDiffZone?.(proposal);
                onProposals?.([proposal]);
              }
            }
            if (evType === 'diffzone_update' && diffZoneRef.current) {
              diffZoneRef.current.proposed = String(raw.proposed || diffZoneRef.current.proposed || '');
              const proposal = {
                fileName: diffZoneRef.current.fileName,
                original: diffZoneRef.current.original,
                proposed: diffZoneRef.current.proposed
              };
              onMissionDiffZone?.(proposal);
              onProposals?.([proposal]);
            }
            if (evType === 'diffzone_complete') {
              diffZoneRef.current = null;
            }
            if (evType === 'proposed_write') {
              const fileName = String(raw.path || '');
              if (fileName) {
                onFileSelect?.(fileName);
                const proposal = {
                  fileName,
                  original: String(raw.original || ''),
                  proposed: String(raw.proposed || '')
                };
                onMissionDiffZone?.(proposal);
                onProposals?.([proposal]);
              }
            }
            if (evType === 'ask') {
              const q = String(raw.question || raw.message || '');
              if (q) {
                useHooshStore.setState({ isPaused: true, askQuestion: q });
              }
            }
            if (evType.startsWith('subagent')) {
              const msg = evType === 'subagents_start'
                ? t('aiPanel.subagentsStart')
                : evType === 'subagent_start'
                  ? `${t('aiPanel.subagentResearch')}: ${String(raw.focus || raw.id || '')}`
                  : evType === 'subagents_complete'
                    ? t('aiPanel.subagentsDone')
                    : thinkingState;
              if (msg) setThinkingState(msg);
            }
            if (String(raw.type) === 'mission_name' && typeof raw.name === 'string') {
              onMissionUpdate?.(raw.name);
            }
            const visualAction = mapUiAgentEvent(raw as Record<string, unknown>);
            if (visualAction) dispatchAgentVisualAction(visualAction);
            if (!text) useHooshStore.getState().ingestAgentEvent(agentEvent);
            setCurrentMission((prev) => reduceMissionState(prev, raw, t));
          }
        }
      }
    );
    if (backendSessionId && assistantAccum.trim()) {
      await syncAssistantToBackend(backendSessionId, assistantAccum);
    }
  };

  const handleImplementPlan = async () => {
    if (isLoading || !pendingPlanImplement) return;
    setPendingPlanImplement(false);
    setMode('agent');
    setIsLoading(true);
    abortControllerRef.current = new AbortController();
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
    try {
      const backendSessionId = await ensureBackendSessionId(activeSessionId, deriveSessionTitle(messages));
      const res = await fetch(`${API_BASE}/api/v3/mission/implement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: backendSessionId }),
        signal: abortControllerRef.current.signal
      });
      if (!res.ok) throw new Error(`Implement failed (${res.status})`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream body');
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n');
        buf = parts.pop() || '';
        for (const line of parts) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line) as { agent_event?: Record<string, unknown> };
            const ev = obj.agent_event;
            if (!ev) continue;
            const evType = String(ev.type || '');
            if (evType === 'token' && ev.token) {
              const tok = String(ev.token);
              setMessages((prev) => {
                const next = [...prev];
                const li = next.length - 1;
                if (li >= 0 && next[li]?.role === 'assistant') {
                  const cur = next[li] as { role: 'assistant'; content: string };
                  next[li] = { role: 'assistant', content: cur.content + tok };
                }
                return next;
              });
              useHooshStore.getState().processStreamText(tok);
            }
            setCurrentMission((prev) => reduceMissionState(prev, ev, t));
          } catch { /* ignore bad line */ }
        }
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        const msg = e instanceof Error ? e.message : String(e);
        setMessages((prev) => {
          const next = [...prev];
          const li = next.length - 1;
          if (li >= 0 && next[li]?.role === 'assistant') {
            next[li] = { role: 'assistant', content: `**Error:** ${msg}` };
          }
          return next;
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = async (textOverride?: string) => {
    if (isLoading) return;
    const promptText = textOverride ?? prompt;
    if (!promptText.trim() && uploadedAssets.length === 0) return;

    const assetsToSend = [...uploadedAssets];
    const rawUserContent = promptText.trim() || t('aiPanel.attachedFiles');

    const mermaidBlock = rawUserContent.match(/```mermaid[\s\S]*?```/i)?.[0] || '';
    if (mermaidBlock) setLastMermaidFlowchart(mermaidBlock);

    const wantsFollowFlowchart =
      /^(follow|execute)\b/i.test(rawUserContent) ||
      /طبق\s+این\b/.test(rawUserContent) ||
      /طبق\s+فلوچارت\b/.test(rawUserContent) ||
      /follow\s+this\s+flowchart/i.test(rawUserContent) ||
      /use\s+this\s+flowchart/i.test(rawUserContent);

    const injectedFlowchartPlan =
      wantsFollowFlowchart && lastMermaidFlowchart
        ? `\n\n[Flowchart plan]\n${mermaidToPlanMarkdown(lastMermaidFlowchart)}\n`
        : '';

    const userContent = rawUserContent + injectedFlowchartPlan;
    const userMessage: ChatMsg = {
      role: 'user',
      content: userContent,
      attachments: assetsToSend.length > 0 ? assetsToSend : undefined
    };
    const threadForApi = [...messages, userMessage];

    useHooshStore.getState().resetMissionLogs();
    setCurrentMission(null);
    setPendingPlanImplement(false);
    setCheckpointTimeline([]);
    setPrompt('');
    setUploadedAssets([]);
    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    setMessages([...threadForApi, { role: 'assistant', content: '' }]);

    let aborted = false;
    let backendSessionId: string | null = null;
    try {
      const sessionTitle = deriveSessionTitle(threadForApi);
      backendSessionId = await ensureBackendSessionId(activeSessionId, sessionTitle);
      await runAssistantStream(threadForApi, backendSessionId);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        aborted = true;
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setMessages((prev) => {
          const next = [...prev];
          const li = next.length - 1;
          if (li >= 0 && next[li]?.role === 'assistant') {
            next[li] = { role: 'assistant', content: `**Error:** ${msg}` };
          }
          return next;
        });
      }
    } finally {
      setIsLoading(false);
      setLoadingModelInfo(null);
      abortControllerRef.current = null;
      void processAssistantFa7Actions(aborted);
    }
  };

  sendMessageRef.current = handleSendMessage;

  useEffect(() => {
    const onInject = (event: Event) => {
      const detail = (event as CustomEvent<AgentInjectDetail>).detail;
      if (!detail?.text) return;
      if (detail.autoSend) {
        void sendMessageRef.current(detail.text);
      } else {
        setPrompt(detail.text);
      }
    };
    const onMission = (event: Event) => {
      const detail = (event as CustomEvent<AgentMissionDetail>).detail;
      if (!detail?.goal) return;
      setMode('agent');
      void sendMessageRef.current(detail.goal);
    };
    window.addEventListener(AGENT_INJECT_EVENT, onInject);
    window.addEventListener(AGENT_MISSION_EVENT, onMission);
    return () => {
      window.removeEventListener(AGENT_INJECT_EVENT, onInject);
      window.removeEventListener(AGENT_MISSION_EVENT, onMission);
    };
  }, []);

  const handleRegenerate = async (index: number) => {
    if (isLoading) return;
    if (messages[index]?.role !== 'assistant') return;
    const userIndex = findPrecedingUserIndex(messages, index);
    if (userIndex < 0) return;

    const userMsg = messages[userIndex] as { role: 'user'; content: string; attachments?: UploadedAsset[] };
    const historyToKeep = messages.slice(0, userIndex);
    const threadForApi = [...historyToKeep, userMsg];

    setPrompt('');
    useHooshStore.getState().resetMissionLogs();
    setCurrentMission(null);
    setMessages([...threadForApi, { role: 'assistant', content: '' }]);
    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    let regenAborted = false;
    try {
      await runAssistantStream(threadForApi);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        regenAborted = true;
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setMessages((prev) => {
          const next = [...prev];
          const li = next.length - 1;
          if (li >= 0 && next[li]?.role === 'assistant') {
            next[li] = { role: 'assistant', content: `**Error:** ${msg}` };
          }
          return next;
        });
      }
    } finally {
      setIsLoading(false);
      setLoadingModelInfo(null);
      abortControllerRef.current = null;
      void processAssistantFa7Actions(regenAborted);
    }
  };

  const undoFromUserMessage = (messageIndex: number, messageText: string, forceSkipConfirm = false) => {
    if (!forceSkipConfirm && !window.confirm('Undo this step?')) return;
    try { abortControllerRef.current?.abort(); } catch { /* ignore */ }
    setIsLoading(false); setCurrentMission(null);
    setMessages((prev) => prev.slice(0, Math.max(0, messageIndex)));
    setPrompt(messageText);
    setContextMenu(null);
  };

  const checkIsLastUserMsg = useCallback((idx: number) => {
    return messages.slice(idx + 1).every(msg => msg.role !== 'user');
  }, [messages]);

  const modeInfo = MODE_CONFIG[mode];

  const startNewChat = (temporary = false) => {
    if (temporary) {
      const tmp = makeEmptySession(`temp_${Date.now()}`, true);
      previousSessionBeforeTemporaryRef.current = activeSessionId || chatSessions[0]?.id || null;
      setIsTemporaryChat(true); setActiveSessionId(tmp.id); setMessages([]); setCurrentMission(null); setPrompt('');
      return;
    }
    const created = makeEmptySession();
    const next = [created, ...chatSessions].slice(0, 50);
    setIsTemporaryChat(false); setChatSessions(next); setActiveSessionId(created.id); setMessages([]); setCurrentMission(null); setPrompt('');
    persistSessions(next); localStorage.setItem(ACTIVE_CHAT_SESSION_KEY, created.id);
  };

  const exitTemporaryChat = () => {
    const target = chatSessions.find((s) => s.id === (previousSessionBeforeTemporaryRef.current || chatSessions[0]?.id)) || chatSessions[0];
    setIsTemporaryChat(false); previousSessionBeforeTemporaryRef.current = null;
    if (!target) { startNewChat(false); return; }
    setActiveSessionId(target.id); setMessages(target.messages || []); setCurrentMission(target.currentMission || null); if (target.mode) setMode(target.mode);
    localStorage.setItem(ACTIVE_CHAT_SESSION_KEY, target.id);
  };

  const toggleTemporaryChat = () => isTemporaryChat ? exitTemporaryChat() : startNewChat(true);

  const switchSession = async (sessionId: string) => {
    const target = chatSessions.find((s) => s.id === sessionId);
    if (!target) return;
    let session = target;
    if (target.backendSessionId) {
      try {
        const r = await axios.get(`${API_BASE}/v3/agent-sessions/${target.backendSessionId}`);
        const backend = r.data?.session;
        if (backend?.messages?.length) {
          session = {
            ...target,
            messages: backend.messages,
            mode: backend.mode || target.mode,
            title: backend.title || target.title
          };
          setChatSessions((prev) => prev.map((s) => s.id === sessionId ? session : s));
        }
      } catch { /* use local copy */ }
    }
    setIsTemporaryChat(false);
    setActiveSessionId(session.id);
    setMessages(session.messages || []);
    setCurrentMission(session.currentMission || null);
    if (session.mode) setMode(session.mode);
    setShowHistoryModal(false);
    localStorage.setItem(ACTIVE_CHAT_SESSION_KEY, session.id);
  };

  const deleteSession = (sessionId: string) => {
    const remaining = chatSessions.filter((s) => s.id !== sessionId);
    if (remaining.length === 0) { startNewChat(false); return; }
    setChatSessions(remaining); persistSessions(remaining);
    if (activeSessionId === sessionId) switchSession(remaining[0].id);
  };

  return (
    <aside className="ai-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '100%', overflow: 'hidden', background: '#09090b', color: '#ededed', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        .ai-panel * { box-sizing: border-box; }
        
        /* ✨ Premium Dynamic Scrollbar for Webkit */
        .ai-panel ::-webkit-scrollbar { width: 14px; height: 14px; }
        .ai-panel ::-webkit-scrollbar-track { background: transparent; }
        .ai-panel ::-webkit-scrollbar-thumb { 
          background: ${modeInfo.color}40; 
          border-radius: 12px; 
          border: 4px solid #09090b; /* Creates a luxurious floating pill effect */
        }
        .ai-panel ::-webkit-scrollbar-thumb:hover { background: ${modeInfo.color}90; }
        
        /* ✨ Firefox Compatibility */
        .chat-messages {
          scrollbar-width: thin;
          scrollbar-color: ${modeInfo.color}40 transparent;
        }

        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .ai-glow { animation: pulseGlow 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulseGlow { 0%, 100% { opacity: 1; filter: drop-shadow(0 0 8px currentColor); } 50% { opacity: .5; filter: drop-shadow(0 0 2px currentColor); } }
        .btn-icon-glass { flex-shrink: 0; touch-action: manipulation; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: #a1a1aa; border-radius: 8px; padding: 7px; cursor: pointer; transition: all 0.2s ease; }
        .btn-icon-glass:hover { background: rgba(255,255,255,0.08); color: #fff; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .btn-icon-glass:active { transform: translateY(0); }
        .chat-input::placeholder { color: #52525b; font-weight: 400; }
        .chat-input:focus { outline: none; border-color: rgba(168, 85, 247, 0.5) !important; box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.2), inset 0 2px 4px rgba(0,0,0,0.4) !important; }
        .gemini-btn { transition: all 0.3s ease; }
        .gemini-btn:hover { background: rgba(168, 85, 247, 0.2) !important; box-shadow: 0 0 12px rgba(168, 85, 247, 0.5); }
        .ctx-menu-btn { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: transparent; border: none; color: #d4d4d8; font-size: 13px; font-weight: 500; border-radius: 8px; cursor: pointer; transition: all 0.2s; text-align: left; width: 100%; }
        .ctx-menu-btn:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
        .ctx-menu-btn.text-red-400:hover { background: rgba(239, 68, 68, 0.15); color: #f87171; }
      `}</style>

      <AIHeader
        onNewChat={() => startNewChat(false)}
        onTempChat={toggleTemporaryChat}
        onNotebook={openNotebookManager}
        pulseStreaming={isLoading}
        onAbort={handleAbortAll}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCheckpointOpen(true);
          }}
          title={t('checkpoint.title')}
          className="inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] p-0 text-[#34d399] transition hover:bg-white/[0.08] hover:text-[#6ee7b7]"
        >
          <History className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setVaultModalOpen(true);
          }}
          title={t('aiPanel.toolVaultTitle')}
          className="inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] p-0 text-[#fbbf24] transition hover:bg-white/[0.08] hover:text-[#fcd34d]"
        >
          <Lock className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowHistoryModal(true);
          }}
          title={t('aiPanel.chatHistoryTitle')}
          className="inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] p-0 text-[#60a5fa] transition hover:bg-white/[0.08] hover:text-[#93c5fd]"
        >
          <MessageSquare className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(t('aiPanel.deleteChatConfirm'))) deleteSession(activeSessionId);
          }}
          title={t('aiPanel.deleteChatTitle')}
          className="inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] p-0 text-[#f87171] transition hover:bg-white/[0.08] hover:text-[#fca5a5]"
        >
          <Trash2 className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </button>
      </AIHeader>

      {isTemporaryChat && (
        <div style={{ padding: '8px 20px', flexShrink: 0, background: 'linear-gradient(90deg, #450a0a, #7f1d1d)', fontSize: '12px', color: '#fecaca', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <span style={{ fontWeight: 500 }}>{t('aiPanel.incognito')}</span>
          <button onClick={exitTemporaryChat} style={{ background: 'rgba(0,0,0,0.3)', color: '#fecaca', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>{t('aiPanel.exitSession')}</button>
        </div>
      )}

      {/* Mode Selector — minWidth:0 so horizontal scroll works inside flex parents */}
      <div
        style={{
          display: 'flex',
          flexShrink: 0,
          width: '100%',
          minWidth: 0,
          gap: '8px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(10, 10, 12, 0.5)'
        }}
        className="hide-scrollbar px-3 py-2.5 sm:px-5"
      >
        {(Object.keys(MODE_CONFIG) as FA7Mode[]).map((m) => {
          const cfg = MODE_CONFIG[m];
          const active = mode === m;
          return (
            <button key={m} onClick={() => setMode(m)} title={cfg.desc}
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '100px',
                fontSize: '11px',
                fontWeight: 600,
                border: `1px solid ${active ? cfg.color : 'rgba(255,255,255,0.05)'}`,
                background: active ? `${cfg.color}15` : 'rgba(255,255,255,0.02)',
                color: active ? cfg.color : '#a1a1aa',
                boxShadow: active ? `0 0 12px ${cfg.color}20` : 'none',
                cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', whiteSpace: 'nowrap'
              }}>
              {cfg.icon} {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Chat Messages Area */}
      <div className="chat-messages" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '20px 10px 20px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <AnimatePresence>
          {messages.length === 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', marginTop: '60px', color: '#71717a' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Brain size={40} color={modeInfo.color} style={{ opacity: 0.8 }} />
              </div>
              <p style={{ marginBottom: '8px', fontSize: '16px', fontWeight: 600, color: '#e4e4e7' }}>{t('aiPanel.readyBuild')}</p>
              <p style={{ fontSize: '13px', opacity: 0.7 }}>{t('aiPanel.modeLine')} <strong style={{ color: modeInfo.color }}>{modeInfo.label}</strong> — {modeInfo.desc}</p>
            </motion.div>
          )}

          {messages.map((m, i) => {
            const isLastMsg = i === messages.length - 1;
            const isGen = isLoading && isLastMsg;

            // Generate Action buttons for assistant messages
            const assistantActionsNode = m.role === 'assistant' ? (
              <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '8px' }}>
                <button onClick={() => handleCopyMessage(m.content, i)}
                  style={{
                    background: copiedIndex === i ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255,255,255,0.03)',
                    color: copiedIndex === i ? '#c084fc' : '#a1a1aa',
                    border: `1px solid ${copiedIndex === i ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: '8px', cursor: 'pointer', fontSize: '11px', padding: '6px 12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                  }}>
                  {copiedIndex === i ? <><Check size={12} /> {t('aiPanel.copied')}</> : <><Copy size={12} /> {t('aiPanel.copy')}</>}
                </button>

                {isLastMsg && !isLoading && (
                  <button onClick={() => handleRegenerate(i)}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      color: '#a1a1aa',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px', cursor: 'pointer', fontSize: '11px', padding: '6px 12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                  >
                    <RefreshCw size={12} /> {t('aiPanel.retry')}
                  </button>
                )}
              </div>
            ) : null;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onContextMenu={(e) => handleContextMenu(e, i, m)}
                style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'context-menu', width: m.role === 'assistant' ? '100%' : 'auto' }}>

                {m.role === 'system_info' || m.role === 'studio_notice' ? (
                  <div style={{
                    fontSize: '12px', color: String(m.content).includes('[ask]') ? '#fca5a5' : '#a1a1aa',
                    padding: '10px 14px', background: String(m.content).includes('[ask]') ? 'rgba(127, 29, 29, 0.4)' : 'rgba(39, 39, 42, 0.4)',
                    borderRadius: '10px', border: `1px solid ${String(m.content).includes('[ask]') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.05)'}`,
                    backdropFilter: 'blur(8px)', width: 'auto', alignSelf: 'center'
                  }}>
                    {String(m.content).includes('[ask]') ? <><HelpCircle size={14} style={{ display: 'inline', marginRight: '6px', marginBottom: '-3px', color: '#ef4444' }} /> {m.content}</> : m.content}
                  </div>
                ) : m.role === 'change_stats' ? (
                  <div style={{ fontSize: '12px', padding: '10px 14px', background: 'rgba(24, 24, 27, 0.6)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '12px', flexWrap: 'wrap', backdropFilter: 'blur(8px)', width: 'auto', alignSelf: 'center' }}>
                    <span style={{ color: '#4ade80', fontWeight: 600 }}>+{m.stats.addedLines} {t('aiPanel.statsAdded')}</span>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>~{m.stats.replacedLines} {t('aiPanel.statsReplaced')}</span>
                    <span style={{ color: '#f87171', fontWeight: 600 }}>-{m.stats.removedLines} {t('aiPanel.statsRemoved')}</span>
                  </div>
                ) : (
                  <div style={{
                    padding: m.role === 'user' ? '16px 20px' : '0',
                    borderRadius: '20px',
                    borderTopRightRadius: m.role === 'user' ? '6px' : '20px',
                    borderTopLeftRadius: m.role === 'user' ? '20px' : '6px',
                    background: m.role === 'user' ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : 'transparent',
                    color: m.role === 'user' ? '#ffffff' : '#f4f4f5',
                    fontSize: '14px', lineHeight: '1.7',
                    boxShadow: m.role === 'user' ? '0 10px 25px -5px rgba(124, 58, 237, 0.4)' : 'none',
                    border: m.role === 'user' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    backdropFilter: m.role === 'user' ? 'none' : 'blur(16px)',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    width: '100%'
                  }}>
                    {m.role === 'user' && m.attachments && m.attachments.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                        {m.attachments.map((a) => (
                          <div key={a.name} style={{ fontSize: '11px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.15)', padding: '6px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', backdropFilter: 'blur(4px)' }}>
                            {a.type.startsWith('image/') ? '🖼️' : <Paperclip size={12} />} {a.name}
                          </div>
                        ))}
                      </div>
                    )}

                    {m.role === 'assistant' ? renderAssistantMessage(m.content, i, activeFile, isGen, isLastMsg, assistantActionsNode, handleOpenLink, t) : m.content}

                    {m.role === 'user' && (
                      <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button onClick={() => handleCopyMessage(m.content, i)} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', padding: '4px 10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {copiedIndex === i ? <><Check size={11} /> {t('aiPanel.copied')}</> : <><Copy size={11} /> {t('aiPanel.copy')}</>}
                        </button>
                        <button onClick={() => undoFromUserMessage(i, m.content, isLoading && checkIsLastUserMsg(i))}
                          style={{
                            background: (isLoading && checkIsLastUserMsg(i)) ? 'rgba(239, 68, 68, 0.8)' : 'rgba(0,0,0,0.2)',
                            color: '#fff',
                            border: `1px solid ${(isLoading && checkIsLastUserMsg(i)) ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                            borderRadius: '8px', cursor: 'pointer', fontSize: '11px', padding: '6px 12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s',
                            boxShadow: (isLoading && checkIsLastUserMsg(i)) ? '0 0 12px rgba(239,68,68,0.4)' : 'none'
                          }}>
                          {(isLoading && checkIsLastUserMsg(i)) ? <><StopCircle size={12} /> {t('aiPanel.stop')}</> : <><Undo2 size={12} /> {t('aiPanel.undo')}</>}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 🚀 Active Mission Visualizer (Unified Command Center) */}
                {i === messages.length - 1 && currentMission && (
                  <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', color: 'hsl(var(--accent))', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '0.8px' }}>
                        <Activity size={16} className={isLoading ? "animate-pulse" : ""} /> {currentMission.name || t('aiPanel.activeMission')}
                      </div>

                      {isLoading && (
                        <button onClick={stopGeneration} style={{ background: '#dc2626', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)' }}>
                          <StopCircle size={14} /> {t('aiPanel.abort')}
                        </button>
                      )}
                    </div>

                    <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{t('aiPanel.status')} <span style={{ color: '#fff', fontWeight: 600 }}>{currentMission.status}</span></span>
                      {currentMission.steps && currentMission.steps.length > 0 && (
                        <span>{currentMission.steps.filter((s: any) => s.status === 'completed').length}/{currentMission.steps.length} {t('aiPanel.tasks')}</span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {currentMission.steps && currentMission.steps.length > 0 && (
                      <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginBottom: '20px', overflow: 'hidden' }}>
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(currentMission.steps.filter((s: any) => s.status === 'completed').length / currentMission.steps.length) * 100}%` }}
                          style={{ height: '100%', background: 'hsl(var(--accent))', boxShadow: '0 0 10px hsl(var(--accent) / 0.5)' }}
                        />
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {currentMission.steps.map((s: any) => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '13px', padding: '10px', background: s.status === 'running' ? 'rgba(255,255,255,0.03)' : 'transparent', borderRadius: '10px', border: s.status === 'running' ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent' }}>
                          <div style={{ marginTop: '2px' }}>
                            {s.status === 'completed' ? <CheckCircle2 size={16} color="#34d399" /> :
                              s.status === 'running' ? <Loader2 size={16} color="hsl(var(--accent))" className="animate-spin" /> :
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)' }} />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                              <span style={{ opacity: s.status === 'pending' ? 0.4 : 1, color: s.status === 'running' ? '#fff' : '#e4e4e7', fontWeight: s.status === 'running' ? 600 : 400 }}>{s.task}</span>
                              <span style={{ fontSize: '10px', opacity: 0.8 }} title={s.assignee}>{getAgentIcon(s.assignee)}</span>
                            </div>
                            {s.status === 'running' && (
                              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: '11px', color: 'hsl(var(--accent))', marginTop: '4px', fontStyle: 'italic' }}>
                                {t('aiPanel.processingStrategy')}
                              </motion.div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {checkpointTimeline.length > 0 && (
                      <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', fontWeight: 600 }}>
                          {t('aiPanel.checkpointCreated')}
                        </div>
                        {checkpointTimeline.map((cp) => (
                          <div key={cp.id + cp.at} style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px', padding: '6px 8px', background: 'rgba(59,130,246,0.08)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <span>
                              <span style={{ color: '#93c5fd' }}>{cp.label}</span>
                              {cp.files.length > 0 && (
                                <span style={{ color: '#666' }}> — {cp.files.join(', ')}</span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm(t('checkpoint.confirmRestore'))) return;
                                try {
                                  const backendId = chatSessions.find((s) => s.id === activeSessionId)?.backendSessionId;
                                  await axios.post(`${API_BASE}/v3/checkpoints/restore`, {
                                    id: cp.id,
                                    sessionId: backendId,
                                    messageIndex: cp.messageIndex
                                  });
                                  if (cp.messageIndex != null) {
                                    setMessages((prev) => prev.slice(0, cp.messageIndex));
                                  }
                                  onRefreshExplorer?.();
                                } catch { /* ignore */ }
                              }}
                              style={{
                                flexShrink: 0,
                                background: 'rgba(16,185,129,0.15)',
                                border: '1px solid rgba(16,185,129,0.35)',
                                color: '#6ee7b7',
                                borderRadius: '6px',
                                padding: '2px 8px',
                                fontSize: '10px',
                                cursor: 'pointer'
                              }}
                            >
                              {t('checkpoint.restore')}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {pendingPlanImplement && !isLoading && (
                      <button
                        type="button"
                        onClick={() => void handleImplementPlan()}
                        style={{
                          marginTop: '14px',
                          width: '100%',
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '10px',
                          padding: '10px 14px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                        }}
                      >
                        <Play size={14} /> {t('aiPanel.implementPlan')}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </div>

      {/* ✨ Custom Context Menu Overlay */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'fixed', top: contextMenu.y, left: contextMenu.x,
              background: 'rgba(24, 24, 27, 0.85)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
              padding: '8px', zIndex: 9999, boxShadow: '0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
              display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px'
            }}
          >
            <button className="ctx-menu-btn" onClick={() => handleCopyMessage(contextMenu.msg.content, contextMenu.index)}>
              <Copy size={14} style={{ opacity: 0.7 }} /> Copy Message
            </button>

            {contextMenu.msg.role === 'assistant' && contextMenu.index === messages.length - 1 && !isLoading && (
              <button className="ctx-menu-btn" onClick={() => { handleRegenerate(contextMenu.index); setContextMenu(null); }}>
                <RefreshCw size={14} style={{ opacity: 0.7 }} /> Retry Generation
              </button>
            )}

            {contextMenu.msg.role === 'user' && (
              <button
                className="ctx-menu-btn"
                onClick={() => undoFromUserMessage(contextMenu.index, contextMenu.msg.content, isLoading && checkIsLastUserMsg(contextMenu.index))}
                style={(isLoading && checkIsLastUserMsg(contextMenu.index)) ? { color: '#fca5a5' } : {}}
              >
                {(isLoading && checkIsLastUserMsg(contextMenu.index)) ? <><StopCircle size={14} style={{ opacity: 0.7 }} /> {t('aiPanel.stopUndo')}</> : <><Undo2 size={14} style={{ opacity: 0.7 }} /> {t('aiPanel.undoStep')}</>}
              </button>
            )}

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

            <button className="ctx-menu-btn text-red-400" onClick={() => deleteSingleMessage(contextMenu.index)}>
              <Trash2 size={14} style={{ opacity: 0.7 }} /> Delete Message
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 💎 PREMIUM INPUT DOCK (Now hosts active CodeBlocks too!) */}
      <div ref={chatDropZoneRef} className="chat-input-container" style={{
        flexShrink: 0,
        padding: '20px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(15, 15, 18, 0.8)',
        backdropFilter: 'blur(24px)',
        position: 'relative'
      }}>

        {/* ✨ DOCKED CODE BLOCKS */}
        {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (() => {
          const msgIndex = messages.length - 1;
          const lastMsg = messages[msgIndex];
          const { parts } = parseAssistantContent(lastMsg.content, isLoading);
          const codeParts = parts.map((p, idx) => ({ ...p, originalIndex: idx })).filter(p => p.type === 'code');

          if (codeParts.length === 0) return null;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', maxHeight: '40vh', overflowY: 'auto', paddingRight: '4px' }} className="hide-scrollbar">
              {codeParts.map((p) => (
                <CodeBlock key={`dock-${p.originalIndex}`} id={`${msgIndex}-${p.originalIndex}`} statusMap={codeStatuses} setStatusMap={setCodeStatuses} lang={p.lang!} code={p.content} activeFile={activeFile} openUpwards={true} />
              ))}
            </div>
          );
        })()}

        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              style={{
                position: 'absolute', inset: 12, borderRadius: '16px',
                background: 'rgba(168, 85, 247, 0.1)',
                border: '2px dashed rgba(168, 85, 247, 0.6)',
                zIndex: 50, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', color: '#c084fc',
                pointerEvents: 'none', backdropFilter: 'blur(4px)'
              }}
            >
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                <Cloud size={36} style={{ marginBottom: '10px' }} />
              </motion.div>
              <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '0.5px' }}>{t('aiPanel.dropZone')}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading && (
          <div style={{ display: 'flex', gap: '10px', padding: '0 0 12px 4px', alignItems: 'center' }}>
            <Loader2 size={16} color={modeInfo.color} className="animate-spin" />
            <motion.span key={thinkingState} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} style={{ fontSize: '13px', color: modeInfo.color, fontWeight: 600, letterSpacing: '0.3px' }}>
              {thinkingState}
            </motion.span>

            {/* Multi-Agent Badge */}
            {loadingModelInfo && (
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'hsl(var(--text-secondary, #999))', background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '12px' }}>
                <span style={{ fontWeight: 600 }}>{loadingModelInfo.name}</span>
                {loadingModelInfo.route === 'online' ? <Cloud size={10} color="#3b82f6" /> : <HardDrive size={10} color="#10b981" />}
              </span>
            )}
          </div>
        )}

        {uploadedAssets.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
            {uploadedAssets.map((a, idx) => {
              const isImg = a.type.startsWith('image/');
              const isCode = /\.(js|ts|jsx|tsx|py|css|html|json|md|java|kt|go|rs|cpp|c|h|sh|yml|yaml)$/i.test(a.name);

              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={idx}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px', borderRadius: '12px',
                    background: 'rgba(24, 24, 27, 0.7)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', backdropFilter: 'blur(12px)',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
                    position: 'relative'
                  }}>

                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: isImg ? 'rgba(168, 85, 247, 0.15)' : isCode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: isImg ? '#c084fc' : isCode ? '#60a5fa' : '#34d399',
                    border: `1px solid ${isImg ? 'rgba(168, 85, 247, 0.2)' : isCode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
                  }}>
                    {isImg ? <ImageIcon size={18} /> : isCode ? <Code size={18} /> : <FileText size={18} />}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '180px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                    <span style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>{isImg ? 'Image File' : isCode ? 'Source Code' : 'Document'}</span>
                  </div>

                  <button
                    onClick={() => removeUploadedAssetAt(idx)}
                    style={{
                      background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)',
                      color: '#a1a1aa', cursor: 'pointer', display: 'flex', alignItems: 'center',
                      padding: '4px', marginLeft: '6px', borderRadius: '50%', transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.background = 'rgba(0,0,0,0.2)'; }}
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

        <div style={{ position: 'relative', borderRadius: '16px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.2), 0 8px 24px -8px rgba(0,0,0,0.5)', transition: 'all 0.3s ease' }}>
          {matchedSkills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px 12px 0' }}>
              <span style={{ fontSize: '10px', color: '#666', alignSelf: 'center' }}>{t('aiPanel.matchedSkills')}:</span>
              {matchedSkills.map((s) => (
                <span key={s.id} title={s.description} style={{
                  fontSize: '10px', background: 'rgba(16,185,129,0.12)', color: '#6ee7b7',
                  padding: '2px 8px', borderRadius: '999px', border: '1px solid rgba(16,185,129,0.25)'
                }}>{s.name || s.id}</span>
              ))}
            </div>
          )}
          {mentionSearch !== null && searchResults.length > 0 && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '4px',
              background: '#252525', border: '1px solid #444', borderRadius: '10px',
              maxHeight: '200px', overflowY: 'auto', zIndex: 10, boxShadow: '0 -4px 20px rgba(0,0,0,0.4)'
            }}>
              {searchResults.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => selectMention(item)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px',
                    background: 'transparent', border: 'none', color: '#ddd', fontSize: '13px',
                    cursor: 'pointer', borderBottom: '1px solid #333'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.15)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {item.startsWith('@') ? item : `@${item}`}
                </button>
              ))}
            </div>
          )}
          {contextFiles.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px 12px 0' }}>
              {contextFiles.map((f) => (
                <span key={f.path} style={{
                  fontSize: '11px', background: 'rgba(59,130,246,0.15)', color: '#93c5fd',
                  padding: '2px 8px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  {f.path}
                  <button type="button" onClick={() => setContextFiles((prev) => prev.filter((x) => x.path !== f.path))}
                    style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          )}
          <textarea
            className="chat-input"
            rows={2}
            placeholder={isLoading ? "Please wait or Abort Mission..." : "Ask Hoosh · @mention files · Type 'continue'"}
            value={prompt}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            disabled={isLoading}
            style={{
              width: '100%', background: 'transparent', border: 'none',
              padding: '16px 140px 16px 20px', fontSize: '14px', color: '#fff',
              resize: 'none', outline: 'none', lineHeight: '1.6'
            }}
          />

          <div style={{ position: 'absolute', right: '12px', bottom: '12px', display: 'flex', gap: '8px' }}>
            <button
              onClick={polishUserText}
              disabled={!prompt.trim() || isLoading || isEnhancing}
              title="Polish text — grammar, spelling, clarity (local model via Hoosh)"
              className="gemini-btn"
              style={{
                background: isEnhancing ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                color: isEnhancing ? '#c084fc' : '#71717a',
                border: 'none', cursor: (!prompt.trim() || isLoading || isEnhancing) ? 'not-allowed' : 'pointer',
                padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center'
              }}>
              {isEnhancing ? <Loader2 size={18} className="animate-spin" color="#c084fc" /> : <Wand2 size={18} color={prompt.trim() ? '#c084fc' : 'currentColor'} />}
            </button>
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={!speechSupported}
              title={
                speechSupported
                  ? isListening
                    ? 'Stop voice input'
                    : 'Voice input (multi-sentence; tap again to stop)'
                  : 'Voice input is not supported in this browser'
              }
              style={{
                background: isListening ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                color: isListening ? '#818cf8' : '#71717a',
                border: 'none',
                cursor: speechSupported ? 'pointer' : 'not-allowed',
                padding: '8px',
                borderRadius: '10px',
                transition: 'all 0.2s',
                opacity: speechSupported ? 1 : 0.45
              }}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <div ref={attachPickerRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setAttachPickerOpen((o) => !o)}
                title="Attach files, folder, or quick prompts"
                aria-expanded={attachPickerOpen ? 'true' : 'false'}
                aria-haspopup="menu"
                style={{
                  background: attachPickerOpen ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                  color: attachPickerOpen ? '#c084fc' : '#71717a',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '10px',
                  transition: 'all 0.2s'
                }}
              >
                <Paperclip size={18} />
              </button>
              {attachPickerOpen && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    right: 0,
                    marginBottom: 8,
                    minWidth: 200,
                    padding: 8,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(24, 24, 27, 0.98)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                    zIndex: 200
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      fileInputRef.current?.click();
                      setAttachPickerOpen(false);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      marginBottom: 4,
                      fontSize: 12,
                      border: 'none',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.06)',
                      color: '#e4e4e7',
                      cursor: 'pointer'
                    }}
                  >
                    Choose files…
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      folderInputRef.current?.click();
                      setAttachPickerOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      marginBottom: 4,
                      fontSize: 12,
                      border: 'none',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.06)',
                      color: '#e4e4e7',
                      cursor: 'pointer'
                    }}
                  >
                    <FolderOpen size={14} style={{ opacity: 0.75, flexShrink: 0 }} />
                    Choose folder…
                  </button>
                  <div
                    style={{
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                      marginTop: 6,
                      paddingTop: 6
                    }}
                  >
                    <div style={{ fontSize: 10, color: '#a1a1aa', padding: '0 4px 6px' }}>{t('aiPanel.quickPrompts')}</div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={insertPlanWorkflowPrompt}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        marginBottom: 4,
                        fontSize: 12,
                        border: 'none',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.06)',
                        color: '#e4e4e7',
                        cursor: 'pointer'
                      }}
                    >
                      <ListOrdered size={14} style={{ opacity: 0.75, flexShrink: 0 }} />
                      Plan & workflow…
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={insertCommentCodePrompt}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        fontSize: 12,
                        border: 'none',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.06)',
                        color: '#e4e4e7',
                        cursor: 'pointer'
                      }}
                    >
                      <MessageSquare size={14} style={{ opacity: 0.75, flexShrink: 0 }} />
                      Comment code…
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button onClick={isLoading ? stopGeneration : () => void handleSendMessage()} disabled={!prompt.trim() && !isLoading && uploadedAssets.length === 0}
              style={{ background: isLoading ? '#dc2626' : modeInfo.color, color: '#fff', border: 'none', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (!prompt.trim() && !isLoading && uploadedAssets.length === 0) ? 'not-allowed' : 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', opacity: (!prompt.trim() && !isLoading && uploadedAssets.length === 0) ? 0.4 : 1, boxShadow: isLoading ? '0 4px 12px rgba(220, 38, 38, 0.4)' : `0 4px 12px ${modeInfo.color}40` }}>
              {isLoading ? <StopCircle size={18} /> : <Send size={18} style={{ transform: 'translateX(1px)' }} />}
            </button>
          </div>
        </div>
        {polishError ? (
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#f87171', lineHeight: 1.4 }}>{polishError}</div>
        ) : null}
      </div>

      <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        title="Folder upload"
        onChange={handleFileUpload}
      />

      {/* 🛡 THE VAULT MANAGER MODAL (Luxury Update) */}
      {vaultModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '640px', background: '#121214', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#fff' }}>
                <div style={{ padding: '8px', background: 'rgba(250, 204, 21, 0.15)', borderRadius: '10px' }}>
                  <Lock size={20} color="#fde047" />
                </div>
                <span style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '0.3px' }}>{t('aiPanel.vaultTitle')}</span>
              </div>
              <button onClick={() => setVaultModalOpen(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}><X size={18} /></button>
            </div>

            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              <p style={{ fontSize: '13px', color: '#a1a1aa', marginBottom: '24px', lineHeight: 1.6 }}>
                {t('aiPanel.vaultBlurb')}
              </p>

              {Object.keys(vaultItems).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#71717a', fontSize: '14px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.05)', marginBottom: '24px' }}>{t('aiPanel.vaultEmpty')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
                  {Object.entries(vaultItems).map(([k, v]) => (
                    <div key={k} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#facc15' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingLeft: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#fef08a', letterSpacing: '0.5px' }}>{k}</span>
                        <button onClick={() => deleteVaultEntry(k)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', cursor: 'pointer', padding: '6px', borderRadius: '6px', transition: 'all 0.2s' }}><Trash2 size={14} /></button>
                      </div>
                      <pre style={{ fontSize: '12px', color: '#d4d4d8', margin: 0, whiteSpace: 'pre-wrap', paddingLeft: '8px', fontFamily: 'ui-monospace, monospace' }}>{v}</pre>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={16} color="#60a5fa" /> Add New Asset
                </div>
                <input value={newVaultKey} onChange={e => setNewVaultKey(e.target.value)} placeholder="Asset Key (e.g. pyarmor_build)" style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px', boxSizing: 'border-box', outline: 'none' }} />
                <textarea value={newVaultVal} onChange={e => setNewVaultVal(e.target.value)} placeholder="Shell Script, JSON Config, or CLI Command..." rows={5} style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', resize: 'vertical', boxSizing: 'border-box', outline: 'none', fontFamily: 'ui-monospace, monospace' }} />
                <button onClick={saveVaultEntry} disabled={!newVaultKey.trim() || !newVaultVal.trim()} style={{ width: '100%', background: (!newVaultKey || !newVaultVal) ? 'rgba(255,255,255,0.05)' : '#3b82f6', color: (!newVaultKey || !newVaultVal) ? '#71717a' : '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: (!newVaultKey || !newVaultVal) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: (!newVaultKey || !newVaultVal) ? 'none' : '0 4px 14px rgba(59,130,246,0.4)' }}>
                  Secure to Vault
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat History */}
      {showHistoryModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 6100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowHistoryModal(false)}
          role="presentation"
        >
          <div
            style={{
              width: 'min(760px, 100%)',
              maxHeight: '86vh',
              background: '#1a1a1a',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 24px 48px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-history-title"
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div id="chat-history-title" style={{ fontWeight: 700, color: '#fff' }}>
                Chat History
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <input
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Search chats…"
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.35)',
                  color: '#e5e7eb',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  fontSize: '12px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ overflow: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minHeight: 0 }}>
              {filteredSortedSessions.length === 0 ? (
                <div style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '18px' }}>{t('aiPanel.noChats')}</div>
              ) : (
                filteredSortedSessions.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      border: s.id === activeSessionId ? '1px solid rgba(139, 92, 246, 0.6)' : '1px solid rgba(255,255,255,0.08)',
                      background: s.id === activeSessionId ? 'rgba(42, 31, 68, 0.5)' : 'rgba(255,255,255,0.03)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.pinned ? '📌 ' : ''}
                        {s.title || 'New Chat'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                        {new Date(s.updatedAt || s.createdAt).toLocaleString()} · mode: {s.mode} · msgs: {Array.isArray(s.messages) ? s.messages.length : 0}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePinSession(s.id)}
                      style={{
                        background: s.pinned ? 'rgba(59, 47, 15, 0.8)' : 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: s.pinned ? '#fbbf24' : '#d4d4d8',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        flexShrink: 0
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Pin size={12} />
                        {s.pinned ? 'Unpin' : 'Pin'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        switchSession(s.id);
                        setShowHistoryModal(false);
                      }}
                      style={{ background: '#2563eb', border: 'none', color: '#fff', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSession(s.id)}
                      style={{ background: 'rgba(127, 29, 29, 0.4)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#fecaca', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notebook */}
      {notebookModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 6100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setNotebookModalOpen(false)}
          role="presentation"
        >
          <div
            style={{
              width: 'min(920px, 100%)',
              maxHeight: '90vh',
              background: '#121214',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 24px 48px rgba(0,0,0,0.6)'
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notebook-modal-title"
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <strong id="notebook-modal-title" style={{ color: '#fff' }}>
                  Notebook
                </strong>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>{notebookPath || '.fa7/notebook.md'}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotebookModalOpen(false)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

            <div style={{ padding: '12px 16px', display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
              {!notebookExists ? (
                <button type="button" onClick={createNotebookNow} style={{ background: '#2563eb', border: 'none', color: '#fff', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                  Create Notebook
                </button>
              ) : (
                <>
                  <button type="button" onClick={saveNotebookDraft} style={{ background: '#2563eb', border: 'none', color: '#fff', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => loadNotebook(false)}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e5e7eb', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    Reload
                  </button>
                  <button type="button" onClick={deleteNotebookNow} style={{ background: 'rgba(127, 29, 29, 0.45)', border: '1px solid rgba(239,68,68,0.3)', color: '#fecaca', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                    Delete Notebook
                  </button>
                </>
              )}
            </div>

            <div style={{ padding: '12px 16px', flex: 1, minHeight: 0, overflow: 'auto' }}>
              {!notebookExists ? (
                <div style={{ color: '#9ca3af', fontSize: '13px' }}>{t('aiPanel.noNotebook')}</div>
              ) : (
                <textarea
                  value={notebookDraft}
                  onChange={(e) => setNotebookDraft(e.target.value)}
                  placeholder="Notebook markdown…"
                  style={{
                    width: '100%',
                    minHeight: '320px',
                    background: 'rgba(0,0,0,0.35)',
                    color: '#e5e7eb',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '10px',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: '12px',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <ApprovalModal />
      <CheckpointPanel
        open={checkpointOpen}
        onClose={() => setCheckpointOpen(false)}
        onRestored={() => onRefreshExplorer?.()}
      />

    </aside>
  );
};

export default AIPanel;
