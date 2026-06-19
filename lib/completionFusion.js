/**
 * Tabby-inspired rank fusion for autocomplete candidates.
 */
function fuseCandidates(sources) {
  const merged = new Map();

  const add = (items, weight, source) => {
    for (const item of items || []) {
      const key = String(item.insertText || item.label || item.text || '').trim();
      if (!key) continue;
      const prev = merged.get(key) || { label: item.label || key, insertText: key, score: 0, sources: [] };
      prev.score += (item.score || 1) * weight;
      prev.sources.push(source);
      if (item.detail) prev.detail = item.detail;
      merged.set(key, prev);
    }
  };

  add(sources.ai, 1.0, 'ai');
  add(sources.lsp, 1.4, 'lsp');
  add(sources.fts, 1.2, 'fts');
  add(sources.recent, 1.5, 'recent');
  add(sources.symbols, 1.3, 'symbols');

  return Array.from(merged.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
}

module.exports = { fuseCandidates };
