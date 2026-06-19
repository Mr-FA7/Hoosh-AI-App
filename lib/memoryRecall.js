/**
 * memoryRecall — pure helpers for the project ContextEngine memory layer.
 * Keyword/overlap scoring + dedupe, kept dependency-free so it is unit-testable
 * in isolation from the kernel's disk-backed memory.
 */

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9_]+/i)
    .filter((w) => w.length > 2);
}

/** Overlap score of a query against a fact's searchable text. */
function scoreFact(query, factText) {
  const q = new Set(tokenize(query));
  if (!q.size) return 0;
  const f = tokenize(factText);
  if (!f.length) return 0;
  let hits = 0;
  for (const w of f) if (q.has(w)) hits++;
  return hits / Math.sqrt(f.length); // normalize so long facts don't dominate
}

/**
 * Rank facts by relevance to a query.
 * facts: [{ text, scope, tags, ... }]
 */
function recallFacts(facts, query, limit = 5) {
  if (!Array.isArray(facts)) return [];
  const scored = facts
    .map((f) => ({ fact: f, score: scoreFact(query, `${f.text || ''} ${(f.tags || []).join(' ')}`) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.fact);
  return scored;
}

/** Stable signature for dedupe (lowercased, whitespace-collapsed prefix). */
function signature(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 160);
}

/** Insert a fact unless an equivalent one already exists; returns new array. */
function upsertFact(facts, fact) {
  const list = Array.isArray(facts) ? facts.slice() : [];
  const sig = signature(fact.text);
  const idx = list.findIndex((f) => signature(f.text) === sig);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...fact, updatedAt: Date.now(), hits: (list[idx].hits || 0) + 1 };
  } else {
    list.push({ ...fact, createdAt: Date.now() });
  }
  return list;
}

/** Insert a learned error pattern {issue, solution} with dedupe. */
function upsertPattern(patterns, pattern) {
  const list = Array.isArray(patterns) ? patterns.slice() : [];
  const sig = signature(pattern.issue);
  const idx = list.findIndex((p) => signature(p.issue) === sig);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...pattern, updatedAt: Date.now(), hits: (list[idx].hits || 0) + 1 };
  } else {
    list.push({ ...pattern, createdAt: Date.now(), hits: 1 });
  }
  return list;
}

module.exports = { tokenize, scoreFact, recallFacts, signature, upsertFact, upsertPattern };
