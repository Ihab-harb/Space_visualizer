import type { Atmosphere, NumberDensityGas } from '../../src/core/details/schema';
import { cellText, parseHtml } from '../lib/html';
import { sheetText } from './nssdcPlanetSheet';

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

const EXOSPHERE_HEADING = /^Estimated Composition\s*\(([^)]*)\)\s*:?\s*$/i;
/** Names the sheet gives without a formula; these are the standard chemical formulas, not sheet values. */
const KNOWN_FORMULAS: Record<string, string> = { Methane: 'CH4', Ammonia: 'NH3' };

/**
 * The Moon Fact Sheet's "Lunar Atmosphere" block: the night composition in particles per cubic cm (the sheet says these are
 * upper limits), plus the sheet's own caveats and its trace and possible species, which have no numbers and go in the note.
 */
export function parseMoonExosphere(html: string, sourceId: string): Atmosphere {
  const lines = sheetText(html).split('\n').map((l) => l.trim());
  const start = lines.findIndex((l) => EXOSPHERE_HEADING.test(l));
  if (start < 0) throw new Error('Moon fact sheet: "Estimated Composition" block not found');
  const basis = EXOSPHERE_HEADING.exec(lines[start]!)![1]!.trim();

  let end = start + 1;
  const block: string[] = [];
  for (; end < lines.length && lines[end] !== ''; end++) block.push(lines[end]!);

  const numberDensity: NumberDensityGas[] = [];
  const extras: string[] = [];
  for (const line of block) {
    const extra = /^(Trace|Possible)\s+(.+)$/.exec(line);
    if (extra) { extras.push(`${extra[1]}: ${extra[2]!.replace(/\s+/g, ' ').trim()}`); continue; }
    for (const entry of line.split(';').map((e) => e.trim()).filter(Boolean)) {
      const m = /^(.+?)\s*(?:\(([^)]+)\))?\s*-\s*([\d,]+(?:\.\d+)?)$/.exec(entry);
      if (!m) throw new Error(`Moon fact sheet: unrecognised exosphere entry "${entry}"`);
      const name = m[1]!.trim();
      numberDensity.push({ name, formula: m[2] ?? KNOWN_FORMULAS[name] ?? name, amount: Number(m[3]!.replace(/,/g, '')), unit: 'cm⁻³', upperLimit: true, sourceId });
    }
  }
  if (numberDensity.length === 0) throw new Error('Moon fact sheet: no exosphere densities found');

  let p = end;
  while (p < lines.length && lines[p] === '') p++;
  const caveat: string[] = [];
  for (; p < lines.length && lines[p] !== ''; p++) caveat.push(lines[p]!);
  const text = [caveat.join(' '), ...extras].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return { basis, kind: 'exosphere', major: [], minor: [], numberDensity, note: text ? { text, sourceId } : null };
}
