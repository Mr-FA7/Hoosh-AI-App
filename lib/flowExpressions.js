/**
 * Hoosh flow expression evaluator — {{ $json.path }} (original, not n8n code).
 */
function getByPath(obj, pathStr) {
  const parts = String(pathStr || '').replace(/^\$json\.?/, '').split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function evaluateExpression(expr, context = {}) {
  const src = String(expr || '');
  const item = context.item || { json: context.json || {} };
  return src.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, inner) => {
    const key = inner.trim();
    if (key === '$now') return new Date().toISOString();
    if (key.startsWith('$json')) return getByPath(item.json, key) ?? '';
    if (key.startsWith('$input')) return getByPath(context.input || {}, key.replace(/^\$input\.?/, '')) ?? '';
    return getByPath(item, key) ?? '';
  });
}

function evaluateObject(obj, context) {
  if (typeof obj === 'string') return evaluateExpression(obj, context);
  if (Array.isArray(obj)) return obj.map((v) => evaluateObject(v, context));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = evaluateObject(v, context);
    return out;
  }
  return obj;
}

module.exports = { evaluateExpression, evaluateObject, getByPath };
