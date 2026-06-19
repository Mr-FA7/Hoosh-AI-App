/**
 * PageRank on file dependency graph (Aider-inspired RepoMap scoring).
 */
function buildAdjacency(index, reverseIndex) {
  const nodes = Array.from(index.keys());
  const nodeSet = new Set(nodes);
  const adj = new Map();
  for (const n of nodes) adj.set(n, new Set());

  for (const [relPath, data] of index.entries()) {
    for (const dep of data.dependencies || []) {
      const match = nodes.find((k) => k.includes(dep) || dep.includes(k) || k.endsWith(dep));
      if (match && match !== relPath) {
        adj.get(match)?.add(relPath);
      }
    }
    for (const user of reverseIndex.get(relPath) || []) {
      if (nodeSet.has(user)) adj.get(relPath)?.add(user);
    }
  }
  return { nodes, adj };
}

function pageRank(index, reverseIndex, options = {}) {
  const { damping = 0.85, iterations = 20 } = options;
  const { nodes, adj } = buildAdjacency(index, reverseIndex);
  if (nodes.length === 0) return new Map();

  const ranks = new Map(nodes.map((n) => [n, 1 / nodes.length]));
  for (let iter = 0; iter < iterations; iter++) {
    const next = new Map();
    for (const n of nodes) {
      let sum = 0;
      for (const [src, outs] of adj.entries()) {
        if (!outs.has(n)) continue;
        const outDeg = outs.size || 1;
        sum += (ranks.get(src) || 0) / outDeg;
      }
      next.set(n, (1 - damping) / nodes.length + damping * sum);
    }
    for (const n of nodes) ranks.set(n, next.get(n));
  }
  return ranks;
}

module.exports = { pageRank, buildAdjacency };
