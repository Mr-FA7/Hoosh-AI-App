/**
 * Conversation-first landing screen.
 *
 * Model chip shows the user's local / self-hosted model (Ollama, LM Studio,
 * or their own API) — never a billed Cursor-style cloud plan.
 */
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ArrowUp, Sparkles, Terminal, Search, Wrench } from 'lucide-react';
import { injectAgentPrompt } from '../lib/agentContextBridge';
import { readActiveModel, subscribeActiveModel, type ActiveModelInfo } from '../lib/activeModelBridge';
import { API_BASE } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';

type Props = {
  onStart: () => void;
  projectName?: string | null;
  onOpenModels?: () => void;
};

function sourceLabel(info: ActiveModelInfo | null, t: (k: string) => string): string {
  const s = String(info?.source || info?.provider || '').toLowerCase();
  if (!info?.name) return t('home.modelNone');
  if (s.includes('ollama') || s === 'local') return t('home.modelLocal');
  if (s.includes('lmstudio') || s.includes('lm studio')) return t('home.modelLmStudio');
  if (s.includes('cloud') || s.includes('api') || s.includes('gateway')) return t('home.modelApi');
  return t('home.modelLocal');
}

const HomeView: React.FC<Props> = ({ onStart, projectName, onOpenModels }) => {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [model, setModel] = useState<ActiveModelInfo | null>(() => readActiveModel());
  const [runtimeOk, setRuntimeOk] = useState<boolean | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => subscribeActiveModel(setModel), []);

  useEffect(() => {
    axios.get(`${API_BASE}/v3/runtime/health`, { timeout: 2000 })
      .then((r) => setRuntimeOk(!!r.data?.ok))
      .catch(() => setRuntimeOk(false));
  }, []);

  const submit = (value?: string) => {
    const message = (value ?? text).trim();
    if (!message) return;
    injectAgentPrompt(message, { autoSend: true });
    setText('');
    onStart();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const suggestions = [
    { icon: <Wrench size={13} />, key: 'home.suggestBuild' },
    { icon: <Search size={13} />, key: 'home.suggestExplain' },
    { icon: <Terminal size={13} />, key: 'home.suggestFix' }
  ];

  return (
    <div className="home-view">
      <div className="home-inner">
        <div className="home-badge">
          <Sparkles size={14} />
          <span>{projectName || t('home.noProject')}</span>
        </div>

        <p className="home-free-line">{t('home.freeFirst')}</p>

        <h1 className="home-title">{t('home.title')}</h1>

        <div className="home-runtime-pill" data-ok={runtimeOk === null ? 'unknown' : runtimeOk ? '1' : '0'}>
          {runtimeOk === null && t('home.runtimeChecking')}
          {runtimeOk === true && t('home.runtimeLocal')}
          {runtimeOk === false && t('home.runtimeOffline')}
        </div>

        <div className="home-composer">
          <textarea
            ref={areaRef}
            className="home-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('home.placeholder')}
            rows={3}
            autoFocus
          />
          <div className="home-composer-footer">
            <button
              type="button"
              className="home-model-chip"
              onClick={() => onOpenModels?.()}
              title={t('home.modelHint')}
            >
              <span className="home-model-name">{model?.name || t('home.modelPick')}</span>
              <span className="home-model-source">{sourceLabel(model, t)}</span>
            </button>
            <div className="home-composer-actions">
              <span className="home-hint">{t('home.enterHint')}</span>
              <button
                className="home-send"
                onClick={() => submit()}
                disabled={!text.trim()}
                aria-label={t('home.send')}
                title={t('home.send')}
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="home-suggestions">
          {suggestions.map((s) => (
            <button key={s.key} className="home-chip" onClick={() => submit(t(s.key))}>
              {s.icon}
              <span>{t(s.key)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomeView;
