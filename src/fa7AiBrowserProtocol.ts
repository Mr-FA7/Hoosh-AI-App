/** Smart browser tags — open Kavosh or preview in a modal. */

export const FA7_AI_BROWSER_SYSTEM_HINT = `
**Internet and live data:** The model is not connected to the live internet. For weather, breaking news, prices, or anything not certain without the web, put **one** of these in your **output** so the IDE can run it:
- Open in Kavosh tab: <!--FA7_AI_BROWSER url="https://example.com" target="kavosh" -->
- Preview: <!--FA7_AI_BROWSER url="https://example.com" target="preview" -->
Example: weather or news — use a sensible URL (official weather site, search engine with q=, etc.). Only http/https; one tag per logical line.
You may explain that for exact numbers/details, the page below will open in the built-in browser.
`.trim();

export function stripFa7AiBrowserTags(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/<!--FA7_AI_BROWSER\s+url="[^"]*"\s+target="[^"]*"\s*-->/g, '')
    .trim();
}

export function extractFa7AiBrowserOpens(str: string): { url: string; target: 'kavosh' | 'preview' }[] {
  const out: { url: string; target: 'kavosh' | 'preview' }[] = [];
  const seen = new Set<string>();
  const re = /<!--FA7_AI_BROWSER\s+url="([^"]+)"\s+target="(kavosh|preview)"\s*-->/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) {
    const url = m[1].trim();
    const target = m[2] as 'kavosh' | 'preview';
    const key = url + '\0' + target;
    if (url && !seen.has(key)) {
      seen.add(key);
      out.push({ url, target });
    }
  }
  return out;
}
