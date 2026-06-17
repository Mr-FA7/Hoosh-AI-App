export type FlowNode = { id: string; label?: string };
export type FlowEdge = { from: string; to: string; label?: string };

export type ParsedFlowchart = {
  direction?: string;
  nodes: Record<string, FlowNode>;
  edges: FlowEdge[];
};

function stripMermaidFence(input: string): string {
  const s = String(input || '');
  const m = s.match(/```mermaid\s*([\s\S]*?)```/i);
  return (m?.[1] ?? s).trim();
}

function parseNodeToken(token: string): { id: string; label?: string } {
  const raw = token.trim();
  // Examples: A[Start], B{Decision}, C((Circle)), D["Quoted label"], E
  const m =
    raw.match(/^([A-Za-z0-9_:-]+)\s*\[\s*([\s\S]*?)\s*\]\s*$/) ||
    raw.match(/^([A-Za-z0-9_:-]+)\s*\(\(\s*([\s\S]*?)\s*\)\)\s*$/) ||
    raw.match(/^([A-Za-z0-9_:-]+)\s*\(\s*([\s\S]*?)\s*\)\s*$/) ||
    raw.match(/^([A-Za-z0-9_:-]+)\s*\{\s*([\s\S]*?)\s*\}\s*$/) ||
    raw.match(/^([A-Za-z0-9_:-]+)\s*\[\s*\"([\s\S]*?)\"\s*\]\s*$/);
  if (m) return { id: m[1], label: m[2] };
  return { id: raw };
}

function cleanEdgeLabel(label: string | undefined): string | undefined {
  const l = (label || '').trim();
  if (!l) return undefined;
  return l.replace(/^\|/, '').replace(/\|$/, '').trim();
}

/**
 * Minimal Mermaid flowchart parser for edges like:
 * - A --> B
 * - A -- text --> B
 * - A -->|yes| B
 * - A --> B[Label]
 */
export function parseMermaidFlowchart(input: string): ParsedFlowchart {
  const body = stripMermaidFence(input);
  const nodes: Record<string, FlowNode> = {};
  const edges: FlowEdge[] = [];
  const lines = body
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('%%'));

  // Detect header: flowchart TD / graph LR
  let direction: string | undefined;
  for (const l of lines) {
    const hm = l.match(/^(flowchart|graph)\s+([A-Za-z]+)/i);
    if (hm) {
      direction = hm[2];
      break;
    }
  }

  for (const line of lines) {
    if (/^(flowchart|graph)\b/i.test(line)) continue;
    // Common edge formats: "A --> B", "A -- label --> B", "A -->|label| B"
    const edgeMatch =
      line.match(/^(.+?)\s*-->\s*(.+)$/) ||
      line.match(/^(.+?)\s*--[^\-]*-->\s*(.+)$/) ||
      line.match(/^(.+?)\s*==>\s*(.+)$/);
    if (!edgeMatch) continue;

    const left = edgeMatch[1].trim();
    const right = edgeMatch[2].trim();

    // Extract inline label between pipes on either side of arrow.
    // e.g. A -->|yes| B
    const pipeLabel = (line.match(/-->\s*\|([\s\S]*?)\|\s*/)?.[1] ??
      line.match(/--\s*([\s\S]*?)\s*-->/)?.[1]) as string | undefined;

    const fromNode = parseNodeToken(left);
    const toNode = parseNodeToken(right);
    nodes[fromNode.id] = nodes[fromNode.id] ?? fromNode;
    // Prefer first non-empty label
    if (fromNode.label && !nodes[fromNode.id].label) nodes[fromNode.id].label = fromNode.label;
    nodes[toNode.id] = nodes[toNode.id] ?? toNode;
    if (toNode.label && !nodes[toNode.id].label) nodes[toNode.id].label = toNode.label;

    edges.push({ from: fromNode.id, to: toNode.id, label: cleanEdgeLabel(pipeLabel) });
  }

  return { direction, nodes, edges };
}

function pickStartNodes(p: ParsedFlowchart): string[] {
  const inDeg: Record<string, number> = {};
  for (const id of Object.keys(p.nodes)) inDeg[id] = 0;
  for (const e of p.edges) {
    inDeg[e.to] = (inDeg[e.to] ?? 0) + 1;
    if (!(e.from in inDeg)) inDeg[e.from] = inDeg[e.from] ?? 0;
  }
  const starts = Object.keys(inDeg).filter((id) => (inDeg[id] ?? 0) === 0);
  return starts.length ? starts : Object.keys(p.nodes);
}

function describeNode(p: ParsedFlowchart, id: string): string {
  const n = p.nodes[id];
  if (!n) return id;
  return n.label ? `${n.label}` : id;
}

/**
 * Convert a flowchart into a stable, readable linear plan.
 * - Topological-ish traversal, best-effort on cycles.
 */
export function flowchartToPlanLines(p: ParsedFlowchart): string[] {
  const outgoing: Record<string, FlowEdge[]> = {};
  for (const e of p.edges) {
    (outgoing[e.from] ||= []).push(e);
  }
  for (const k of Object.keys(outgoing)) {
    outgoing[k].sort((a, b) => (a.to + (a.label || '')).localeCompare(b.to + (b.label || '')));
  }

  const lines: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const walk = (id: string) => {
    if (visiting.has(id)) return; // cycle guard
    if (visited.has(id)) return;
    visiting.add(id);
    visited.add(id);

    const outs = outgoing[id] || [];
    if (outs.length === 0) {
      lines.push(describeNode(p, id));
    } else {
      // If node itself is meaningful, include it; then list edges.
      const nodeText = describeNode(p, id);
      if (nodeText && !lines.includes(nodeText)) lines.push(nodeText);
      for (const e of outs) {
        const edgeHint = e.label ? ` (${e.label})` : '';
        const step = `${describeNode(p, e.from)} -> ${describeNode(p, e.to)}${edgeHint}`;
        lines.push(step);
        walk(e.to);
      }
    }
    visiting.delete(id);
  };

  for (const s of pickStartNodes(p)) walk(s);
  return Array.from(new Set(lines)).filter(Boolean);
}

export function mermaidToPlanMarkdown(mermaid: string): string {
  const parsed = parseMermaidFlowchart(mermaid);
  const plan = flowchartToPlanLines(parsed);
  const bullets = plan.map((l, i) => `${i + 1}. ${l}`).join('\n');
  return [
    '## Flowchart-derived plan',
    '',
    bullets || '(empty)',
    '',
    '## Flowchart (reference)',
    '',
    '```mermaid',
    stripMermaidFence(mermaid),
    '```'
  ].join('\n');
}

