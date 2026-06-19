/**
 * Gather mode — read-only context collection before edits (Void-inspired).
 */
class GatherMode {
  constructor(kernel, indexer, llmGateway = null) {
    this.kernel = kernel;
    this.indexer = indexer;
    this.llmGateway = llmGateway;
  }

  async gather(goal, options = {}) {
    const emit = options.onEvent || (() => {});
    const readOnlyTools = new Set(['readFile', 'webSearch', 'deepResearch', 'recall', 'changeDirectory']);
    const prevMode = this.kernel.agentMode;
    this.kernel.setAgentMode('gather');

    const parts = [];
    parts.push(this.indexer.getRepoMap ? this.indexer.getRepoMap(goal, { maxChars: 10000 }) : '');
    if (this.indexer.hybridSearch) {
      try {
        const hits = await this.indexer.hybridSearch(goal, 8);
        if (hits.merged?.length) {
          parts.push(hits.merged.map((h) => `### ${h.path}\n${h.text || ''}`).join('\n\n'));
        } else {
          parts.push(hits.fts?.length ? this.indexer.ftsIndex?.formatForContext(hits.fts) : '');
          parts.push(hits.vector?.length ? this.indexer.vectorIndex?.formatForContext(hits.vector) : '');
        }
      } catch { /* ignore */ }
    }

    emit('gather_start', { goal });
    emit('gather_context', { chars: parts.join('\n').length });

    const files = this.indexer.search ? this.indexer.search(goal, 10) : [];
    for (const rel of files.slice(0, 5)) {
      try {
        if (!readOnlyTools.has('readFile')) continue;
        const content = await this.kernel.executeTool('readFile', { path: rel }, emit);
        if (content && !String(content).startsWith('Tool error') && !String(content).startsWith('Security')) {
          parts.push(`\n## File: ${rel}\n${String(content).slice(0, 4000)}`);
          emit('gather_file', { path: rel });
        }
      } catch { /* ignore */ }
    }

    this.kernel.setAgentMode(prevMode);
    emit('gather_complete', { files: files.length });

    const rawContext = parts.filter(Boolean).join('\n\n');
    if (!this.llmGateway || rawContext.length < 200) return rawContext.slice(0, 12000);

    emit('status', { message: 'Synthesizing gathered context...' });
    try {
      const summary = await this.llmGateway.generate({
        prompt: `Goal: ${goal}\n\nGathered codebase context:\n${rawContext.slice(0, 14000)}\n\nWrite a concise research summary: key files, patterns, and recommended edit targets. Same language as goal.`,
        role: 'plan',
        options: { num_predict: 900 }
      });
      return `## Gather Summary\n${String(summary || '').trim()}\n\n## Raw Context (truncated)\n${rawContext.slice(0, 8000)}`;
    } catch {
      return rawContext.slice(0, 12000);
    }
  }
}

module.exports = { GatherMode };
