import axios from 'axios';
import type { FA7Mode } from './fa7StudioProtocol';
import {
  extractFa7DevReads,
  extractFa7DevWrites,
  extractFa7GiraDownloads,
  extractFa7SystemInstalls,
  extractFa7TerminalRuns,
  stripFa7DevTags
} from './fa7StudioProtocol';
import { extractFa7AiBrowserOpens, stripFa7AiBrowserTags } from './fa7AiBrowserProtocol';

export interface Fa7ActionDeps {
  apiBase: string;
  mode: FA7Mode;
  onProposals?: (proposals: { fileName: string; original: string; proposed: string }[]) => void;
  onOpenKavosh?: (url: string) => void;
  onOpenTerminal?: (opts?: { aiStatus?: string }) => void;
  onOpenDownload?: (opts?: { initialUrl?: string; aiStatus?: string }) => void;
  onFileSelect?: (path: string) => void;
  onRefreshExplorer?: () => void;
  appendSystemInfo?: (message: string) => void;
}

/** Strip FA7 machine tags from assistant text shown in chat. */
export function stripFa7ActionTags(text: string): string {
  return stripFa7AiBrowserTags(stripFa7DevTags(text)).trim();
}

/**
 * Execute FA7 protocol tags emitted in chat responses (read/write/terminal/browser).
 * Agent mode uses kernel mission loop; this path covers ask/gather/chat fallbacks.
 */
export async function runFa7ActionsFromAssistant(content: string, deps: Fa7ActionDeps): Promise<void> {
  if (!content?.trim()) return;

  const allowWrites = deps.mode === 'agent' || deps.mode === 'debug';
  const reads = extractFa7DevReads(content);
  const writes = allowWrites ? extractFa7DevWrites(content) : [];
  const terminals = allowWrites ? extractFa7TerminalRuns(content) : [];
  const installs = allowWrites ? extractFa7SystemInstalls(content) : [];
  const downloads = allowWrites ? extractFa7GiraDownloads(content) : [];
  const browsers = extractFa7AiBrowserOpens(content);

  for (const rel of reads) {
    try {
      const res = await axios.get(`${deps.apiBase}/file`, { params: { path: rel } });
      const body = String(res.data?.content || '').slice(0, 6000);
      deps.onFileSelect?.(rel);
      deps.appendSystemInfo?.(`📄 Read \`${rel}\` (${body.length} chars)`);
      if (body && body.length < 4000) {
        deps.appendSystemInfo?.(`\`\`\`\n${body}\n\`\`\``);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      deps.appendSystemInfo?.(`⚠️ Could not read \`${rel}\`: ${msg}`);
    }
  }

  for (const w of writes) {
    let original = '';
    try {
      const res = await axios.get(`${deps.apiBase}/file`, { params: { path: w.path } });
      original = String(res.data?.content || '');
    } catch {
      original = '';
    }
    deps.onProposals?.([{ fileName: w.path, original, proposed: w.content }]);
    deps.appendSystemInfo?.(`✏️ Proposed changes for \`${w.path}\` — review in diff panel.`);
  }

  const terminalCommands = [...terminals, ...installs];
  if (terminalCommands.length > 0) {
    deps.onOpenTerminal?.({ aiStatus: 'running' });
    for (const command of terminalCommands) {
      try {
        const res = await axios.post(`${deps.apiBase}/v3/terminal/exec`, { command });
        const ok = !!res.data?.ok;
        const out = String(res.data?.stdout || res.data?.stderr || res.data?.error || '').slice(0, 2000);
        deps.appendSystemInfo?.(
          ok
            ? `🖥️ \`${command}\`\n\`\`\`\n${out || '(no output)'}\n\`\`\``
            : `⚠️ Command failed: \`${command}\`\n${out}`
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        deps.appendSystemInfo?.(`⚠️ Terminal error for \`${command}\`: ${msg}`);
      }
    }
  }

  for (const url of downloads) {
    deps.onOpenDownload?.({ initialUrl: url, aiStatus: 'queued' });
    deps.appendSystemInfo?.(`⬇️ Gira download queued: ${url}`);
  }

  for (const open of browsers) {
    if (open.target === 'kavosh' || open.target === 'preview') {
      deps.onOpenKavosh?.(open.url);
      deps.appendSystemInfo?.(`🌐 Opened in Kavosh: ${open.url}`);
    }
  }

  if (writes.length > 0) {
    deps.onRefreshExplorer?.();
  }
}
