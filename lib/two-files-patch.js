'use strict';

/**
 * Unified diff کوتاه برای پیش‌نمایش (مثل Fard Terminal).
 */
function createTwoFilesPatch(
  oldFileName,
  newFileName,
  oldStr,
  newStr,
  oldHeader,
  newHeader
) {
  const o = String(oldStr ?? '').replace(/\r\n/g, '\n');
  const n = String(newStr ?? '').replace(/\r\n/g, '\n');
  if (o === n) return '';

  function toLines(text) {
    if (text === '') return [];
    const trailing = text.endsWith('\n');
    const parts = text.split('\n');
    const lines = [];
    for (let i = 0; i < parts.length; i++) {
      const last = i === parts.length - 1;
      if (last && trailing && parts[i] === '') {
        continue;
      }
      if (last && !trailing) {
        lines.push(parts[i]);
      } else {
        lines.push(parts[i] + '\n');
      }
    }
    return lines;
  }

  const ol = toLines(o);
  const nl = toLines(n);
  const hunkLines = [];
  for (const line of ol) hunkLines.push('-' + line);
  for (const line of nl) hunkLines.push('+' + line);

  const oldCount = ol.length;
  const newCount = nl.length;
  const oldStart = oldCount === 0 ? 0 : 1;
  const newStart = newCount === 0 ? 0 : 1;

  const oldH = typeof oldHeader === 'undefined' ? '' : '\t' + oldHeader;
  const newH = typeof newHeader === 'undefined' ? '' : '\t' + newHeader;

  const ret = [];
  if (oldFileName === newFileName) {
    ret.push('Index: ' + oldFileName);
  }
  ret.push('===================================================================');
  ret.push('--- ' + oldFileName + oldH);
  ret.push('+++ ' + newFileName + newH);
  ret.push(
    '@@ -' + oldStart + ',' + oldCount + ' +' + newStart + ',' + newCount + ' @@'
  );
  ret.push.apply(ret, hunkLines);
  return ret.join('\n') + '\n';
}

module.exports = { createTwoFilesPatch };
