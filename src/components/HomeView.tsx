/**
 * Conversation-first landing screen.
 *
 * The old landing was the editor's "No file open" state — a form with folder
 * pickers and file-name fields, which puts IDE chrome in front of someone who
 * just wants to describe a task. Tools like Cursor and Qwen instead open on a
 * single centred prompt. This is that screen: it hands the text to the agent
 * over the existing inject-prompt bridge and switches to the working layout.
 */
import React, { useRef, useState } from 'react';
import { ArrowUp, Sparkles, Terminal, Search, Wrench } from 'lucide-react';
import { injectAgentPrompt } from '../lib/agentContextBridge';
import { useI18n } from '../i18n/LocaleContext';

type Props = {
  /** Switch to the working layout once a prompt is sent. */
  onStart: () => void;
  projectName?: string | null;
};

const HomeView: React.FC<Props> = ({ onStart, projectName }) => {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const areaRef = useRef<HTMLTextAreaElement>(null);

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

        <h1 className="home-title">{t('home.title')}</h1>

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
