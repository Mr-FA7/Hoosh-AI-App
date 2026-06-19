/**
 * Line-based inline diff → Monaco executeEdits (Void/Cursor-style pushEditOperations).
 */

export type MonacoEdit = {
  range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
  text: string;
  forceMoveMarkers?: boolean;
};

export function buildInlineEdits(
  monaco: { Range: new (...args: number[]) => unknown },
  original: string,
  proposed: string
): MonacoEdit[] {
  const oLines = original.split('\n');
  const nLines = proposed.split('\n');

  let prefix = 0;
  while (prefix < oLines.length && prefix < nLines.length && oLines[prefix] === nLines[prefix]) {
    prefix++;
  }

  let oSuffix = oLines.length - 1;
  let nSuffix = nLines.length - 1;
  while (oSuffix >= prefix && nSuffix >= prefix && oLines[oSuffix] === nLines[nSuffix]) {
    oSuffix--;
    nSuffix--;
  }

  if (prefix > oSuffix && prefix > nSuffix) return [];

  const startLine = prefix + 1;
  const endLine = Math.max(prefix + 1, oSuffix + 1);
  const endColumn =
    oSuffix >= prefix && oLines[oSuffix] !== undefined
      ? oLines[oSuffix].length + 1
      : 1;

  let replaceText = nLines.slice(prefix, nSuffix + 1).join('\n');
  if (nSuffix + 1 < nLines.length && oSuffix + 1 < oLines.length) {
    replaceText += '\n';
  }

  return [{
    range: new monaco.Range(startLine, 1, endLine, endColumn) as MonacoEdit['range'],
    text: replaceText,
    forceMoveMarkers: true
  }];
}
