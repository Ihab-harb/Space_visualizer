import { cellText, parseHtml } from '../lib/html';

/**
 * The Moon Fact Sheet: row label -> the Moon's number (the first number in the first cell after the label).
 * The label is the text before the first "(", without the footnote asterisk, e.g. "Perigee (10^6 km)*" -> "Perigee".
 * The first row with a given label wins.
 */
export function parseMoonFactSheet(html: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const tr of parseHtml(html).querySelectorAll('tr')) {
    const ths = tr.querySelectorAll('th');
    const tds = tr.querySelectorAll('td');
    if (ths.length !== 1 || tds.length === 0) continue;
    const label = cellText(ths[0]!).split('(')[0]!.replace(/\*/g, '').trim();
    const number = /-?\d[\d,]*(?:\.\d+)?/.exec(cellText(tds[0]!));
    if (!label || !number || out.has(label)) continue;
    out.set(label, Number(number[0].replace(/,/g, '')));
  }
  return out;
}
