/**
 * deepResearch — multi-source web research with full-page fetch + cited synthesis.
 *
 * Upgrades the previous DuckDuckGo Instant-Answer-snippets-only path:
 *  - parses the DuckDuckGo HTML SERP for real result links,
 *  - fetches the top pages and extracts readable text,
 *  - returns cited excerpts the agent can synthesize from.
 *
 * Network functions are best-effort (timeouts + try/catch). HTML parsing and
 * text extraction are pure and unit-tested offline.
 */
const axios = require('axios');

const UA = 'Mozilla/5.0 (compatible; HooshAI-Research/1.0)';

/** Strip HTML to readable plain text (removes script/style/tags, collapses ws). */
function htmlToText(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|h[1-6]|li|br|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Parse DuckDuckGo HTML SERP markup into [{ title, url }]. */
function parseDuckDuckGoHtml(html, limit = 5) {
  if (!html) return [];
  const out = [];
  const re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < limit) {
    let url = m[1];
    // DuckDuckGo wraps targets as /l/?uddg=<encoded>
    const wrapped = url.match(/[?&]uddg=([^&]+)/);
    if (wrapped) { try { url = decodeURIComponent(wrapped[1]); } catch { /* keep */ } }
    const title = htmlToText(m[2]);
    if (url && /^https?:\/\//.test(url)) out.push({ title, url });
  }
  return out;
}

/** Fetch the DuckDuckGo HTML SERP and return result links. */
async function searchLinks(query, limit = 5, timeoutMs = 10000) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const r = await axios.get(url, { timeout: timeoutMs, headers: { 'User-Agent': UA } });
  return parseDuckDuckGoHtml(r.data, limit);
}

/** Fetch a page and return a trimmed readable excerpt. */
async function fetchReadable(url, maxChars = 2000, timeoutMs = 10000) {
  try {
    const r = await axios.get(url, {
      timeout: timeoutMs,
      headers: { 'User-Agent': UA },
      maxContentLength: 3 * 1024 * 1024,
      responseType: 'text'
    });
    return htmlToText(String(r.data)).slice(0, maxChars);
  } catch (e) {
    return '';
  }
}

/**
 * Run deep research: SERP -> fetch top pages -> cited excerpts.
 * Returns { ok, sources: [{title, url, excerpt}], text } where text is a
 * citation-formatted block the agent can synthesize from.
 */
async function deepResearch(query, { maxPages = 3, perPageChars = 1500 } = {}) {
  let links = [];
  try {
    links = await searchLinks(query, Math.max(maxPages, 4));
  } catch (e) {
    return { ok: false, error: `Search failed: ${e.message}`, sources: [], text: '' };
  }
  if (!links.length) return { ok: false, error: 'No results', sources: [], text: '' };

  const top = links.slice(0, maxPages);
  const fetched = await Promise.all(top.map(async (l) => ({
    title: l.title,
    url: l.url,
    excerpt: await fetchReadable(l.url, perPageChars)
  })));
  const sources = fetched.filter((s) => s.excerpt);

  const text = (sources.length ? sources : top.map((l) => ({ ...l, excerpt: '' })))
    .map((s, i) => `[${i + 1}] ${s.title || s.url}\n    URL: ${s.url}\n${s.excerpt ? '    ' + s.excerpt.replace(/\n/g, '\n    ') : '    (no extract)'}`)
    .join('\n\n');

  return { ok: true, sources, text };
}

module.exports = { htmlToText, parseDuckDuckGoHtml, searchLinks, fetchReadable, deepResearch };
