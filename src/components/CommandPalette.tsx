import React, { useEffect, useMemo, useRef, useState } from 'react';
import { VIEW_CATALOG, type ViewEntry, type ViewMode } from '../shell/viewCatalog';
import { useI18n } from '../i18n/LocaleContext';
import './CommandPalette.css';

type Command = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  keywords: string;
  run: () => void;
};

type Props = {
  open: boolean;
  viewMode: ViewMode;
  onClose: () => void;
  onNavigate: (mode: ViewMode) => void;
  onToggleAgent: () => void;
  agentCollapsed: boolean;
};

function score(query: string, ...fields: string[]): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const hay = fields.join(' ').toLowerCase();
  const at = hay.indexOf(q);
  if (at < 0) return 0;
  return 100 - at;
}

const CommandPalette: React.FC<Props> = ({
  open, viewMode, onClose, onNavigate, onToggleAgent, agentCollapsed
}) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const fromView = (v: ViewEntry): Command => ({
      id: `view:${v.id}`,
      label: t(v.labelKey),
      hint: v.audience === 'agent' ? t('palette.agentHint') : undefined,
      group: v.audience === 'agent' ? t('palette.groupAgent') : v.group === 'build' ? t('palette.groupBuild') : t('palette.groupNav'),
      keywords: `${v.id} ${v.keywords}`,
      run: () => onNavigate(v.id)
    });
    return [
      ...VIEW_CATALOG.map(fromView),
      {
        id: 'cmd:toggle-agent',
        label: agentCollapsed ? t('layout.showAgent') : t('layout.hideAgent'),
        hint: t('palette.toggleAgentHint'),
        group: t('palette.groupCommands'),
        keywords: 'agent panel chat j',
        run: onToggleAgent
      }
    ];
  }, [t, onNavigate, onToggleAgent, agentCollapsed]);

  const filtered = useMemo(() => {
    const ranked = commands
      .map((c) => ({ c, s: score(query, c.label, c.keywords, c.hint || '') }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    return ranked.map((x) => x.c);
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const hit = filtered[active];
        if (hit) {
          hit.run();
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, active, onClose]);

  if (!open) return null;

  const groups: { name: string; items: { cmd: Command; index: number }[] }[] = [];
  filtered.forEach((cmd, index) => {
    const last = groups[groups.length - 1];
    if (!last || last.name !== cmd.group) groups.push({ name: cmd.group, items: [{ cmd, index }] });
    else last.items.push({ cmd, index });
  });

  return (
    <div className="command-palette-root" onMouseDown={onClose} role="presentation">
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label={t('palette.title')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="command-palette-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('palette.placeholder')}
          aria-label={t('palette.title')}
        />
        <div className="command-palette-list" role="listbox">
          {filtered.length === 0 && (
            <div className="command-palette-empty">{t('palette.empty')}</div>
          )}
          {groups.map((g) => (
            <div key={`${g.name}-${g.items[0].cmd.id}`} className="command-palette-group">
              <div className="command-palette-group-label">{g.name}</div>
              {g.items.map(({ cmd, index }) => (
                <button
                  key={cmd.id}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  className={`command-palette-item ${index === active ? 'active' : ''} ${cmd.id === `view:${viewMode}` ? 'current' : ''}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => {
                    cmd.run();
                    onClose();
                  }}
                >
                  <span className="command-palette-item-label">{cmd.label}</span>
                  {cmd.hint && <span className="command-palette-item-hint">{cmd.hint}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
