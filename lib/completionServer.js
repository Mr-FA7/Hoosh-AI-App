/**
 * Tabby-inspired completion server — FTS5 BM25 (Tantivy-like) + fusion.
 */
const path = require('path');
const { fuseCandidates } = require('./completionFusion');

class CompletionServer {
  constructor({ indexer, lspBridge, llmGateway } = {}) {
    this.indexer = indexer;
    this.lspBridge = lspBridge;
    this.llmGateway = llmGateway;
  }

  symbolCandidates(fileName, prefix) {
    if (!this.indexer?.index) return [];
    const rel = String(fileName || '').replace(/^\.\//, '');
    const entry = this.indexer.index.get(rel);
    if (!entry?.symbols?.length) return [];
    const needle = String(prefix || '').split(/[\s.(]+/).pop()?.toLowerCase() || '';
    return entry.symbols
      .filter((s) => {
        const name = String(s.name || s.content || '').toLowerCase();
        return !needle || name.includes(needle);
      })
      .slice(0, 8)
      .map((s) => ({
        label: s.name || s.content,
        insertText: s.name || s.content,
        detail: s.kind || 'symbol',
        score: 2.2
      }));
  }

  tantivyLikeHits(query, topK = 8) {
    const hits = this.indexer?.ftsSearch ? this.indexer.ftsSearch(query, topK) : [];
    return hits.map((h) => ({
      label: path.basename(h.path),
      insertText: (h.text || '').replace(/[«»]/g, '').split('\n')[0] || '',
      detail: h.path,
      score: Math.max(0.5, 3 - Math.abs(h.score || 0) * 0.1),
      source: 'tantivy-like-fts'
    }));
  }

  async aiSuggestion({ prefix, suffix, fileName, model, nes, query }) {
    if (!this.llmGateway?.generate) return '';
    let repoCtx = '';
    const ragQuery = String(query || prefix || fileName || '').trim();
    if (ragQuery && this.indexer?.hybridSearch) {
      try {
        const hybrid = await this.indexer.hybridSearch(ragQuery, 6);
        if (hybrid.merged?.length) {
          repoCtx = hybrid.merged.map((h) => `// ${h.path}\n${(h.text || '').slice(0, 600)}`).join('\n\n').slice(0, 6000);
        }
      } catch { /* ignore */ }
    }
    if (!repoCtx && this.indexer?.getRepoMap) {
      repoCtx = this.indexer.getRepoMap(fileName || '', { maxChars: 3500 });
    }
    const prompt = nes ? [
      `File: ${fileName || 'unknown'}`,
      repoCtx ? `Project context:\n${repoCtx}` : '',
      'Predict the SINGLE next edit at <CURSOR>. Output ONLY new lines.',
      `${prefix}<CURSOR>${suffix}`
    ].filter(Boolean).join('\n\n') : [
      `File: ${fileName || 'unknown'}`,
      repoCtx ? `Project context:\n${repoCtx}` : '',
      'Complete code at <CURSOR>. Output ONLY the next lines.',
      `${prefix}<CURSOR>${suffix}`
    ].filter(Boolean).join('\n\n');

    return this.llmGateway.generate({
      model: model || undefined,
      prompt,
      role: nes ? 'nes' : 'autocomplete',
      options: { num_predict: nes ? 120 : 80, stop: ['\n\n', '```', '<CURSOR>'] }
    });
  }

  async complete(body = {}) {
    const { prefix = '', suffix = '', fileName = '', model, nes, fuse = true, query } = body;
    const line = (prefix.match(/\n/g) || []).length + 1;
    const col = prefix.length - (prefix.lastIndexOf('\n') + 1);

    let suggestion = '';
    try {
      suggestion = String(await this.aiSuggestion({ prefix, suffix, fileName, model, nes, query }) || '').trim();
    } catch {
      /* LLM optional — FTS/LSP/symbol fusion still works */
    }

    let fused;
    if (fuse !== false) {
      const lspItems = this.lspBridge
        ? await this.lspBridge.completion(fileName, line, col, prefix + suffix).catch(() => [])
        : [];
      const ftsHits = this.tantivyLikeHits(query || fileName || prefix, 6);
      const symbols = this.symbolCandidates(fileName, prefix);
      const recent = (this.indexer?.recentEdits || []).slice(0, 3).map((p) => ({
        label: path.basename(p),
        insertText: path.basename(p),
        score: 2
      }));
      fused = fuseCandidates({
        ai: suggestion ? [{ label: 'AI', insertText: suggestion, score: 3 }] : [],
        lsp: lspItems.map((i) => ({ ...i, score: 1.5 })),
        fts: ftsHits,
        symbols,
        recent
      });
    }

    return {
      suggestion,
      fused,
      backend: this.indexer?.ftsIndex?.constructor?.name === 'SqliteFtsIndex' ? 'sqlite-fts5-bm25' : 'json-bm25'
    };
  }
}

module.exports = { CompletionServer };
