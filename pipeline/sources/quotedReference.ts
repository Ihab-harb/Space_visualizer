import type { MissionOutcome, MissionType } from '../../src/core/details/schema';
import { decodeEntities } from '../lib/html';

export interface CuratedSource { id: string; title: string; publisher: string; url: string; license: string }
export interface Quoted { sourceId: string; quote: string }
export interface QuotedRange extends Quoted { min: number; max: number }
export interface CuratedLayer {
  id: string; name: string; from: 'radius' | 'depth' | 'percent';
  outer: QuotedRange; inner: QuotedRange; // radii in km, depths in km below the surface, or percent of the body's radius from the centre
  state: 'solid' | 'liquid' | 'gas' | 'plasma' | 'unknown';
  composition: (Quoted & { text: string }) | null;
  uncertain: boolean;
}
export interface CuratedMission { id: string; name: string; agency: string; type: MissionType; launchDate: string; arrivalDate: string | null; endDate: string | null; outcome: MissionOutcome; sourceId: string; quotes: string[] }
export type CuratedDiscovery = (Quoted & { kind: 'antiquity' }) | (Quoted & { kind: 'discovered'; by: string; date: string; method: string });
export interface InteriorsFile { sources: CuratedSource[]; bodies: Record<string, { layers: CuratedLayer[] }> }
export interface MissionsFile { sources: CuratedSource[]; bodies: Record<string, { discovery: CuratedDiscovery | null; missions: CuratedMission[] }> }

/** Straight quotes, hyphen dashes, plain spaces, collapsed whitespace. */
export function normaliseQuote(q: string): string {
  return q
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Visible text of a page, normalised the same way as quotes. */
export function pageText(html: string): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  return normaliseQuote(decodeEntities(stripped));
}

export function quoteOnPage(quote: string, page: string): boolean {
  const q = normaliseQuote(quote).toLowerCase();
  return q.length > 0 && normaliseQuote(page).toLowerCase().includes(q);
}

interface Num { value: number; start: number; end: number }

const NUM = /(?<![\d.,])(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?!\d)/g;

function scan(text: string): Num[] {
  const out: Num[] = [];
  for (const m of text.matchAll(NUM)) {
    out.push({ value: Number(m[1]!.replace(/,/g, '')), start: m.index!, end: m.index! + m[0].length });
  }
  return out;
}

export function numbersIn(text: string): number[] {
  return scan(text).map((n) => n.value);
}

const same = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

export function quoteHasNumber(quote: string, n: number): boolean {
  return numbersIn(quote).some((v) => same(v, n));
}

const KM_UNIT = /^\s*(?:km|kilometers?|kilometres?)(?![A-Za-z0-9/])/i;
const PERCENT_UNIT = /^\s*(?:%|percent(?![A-Za-z]))/i;
const RANGE_GAP = /^\s*(?:-|to|and)\s*$/i;

/** Numbers followed by the unit, or the first number of a range whose second number is. */
function withUnit(text: string, unit: RegExp): number[] {
  const t = normaliseQuote(text);
  const nums = scan(t);
  const hit: boolean[] = new Array<boolean>(nums.length).fill(false);
  for (let i = nums.length - 1; i >= 0; i--) {
    const n = nums[i]!;
    if (unit.test(t.slice(n.end))) { hit[i] = true; continue; }
    const next = nums[i + 1];
    if (next && hit[i + 1] && RANGE_GAP.test(t.slice(n.end, next.start))) hit[i] = true;
  }
  return nums.filter((_, i) => hit[i]).map((n) => n.value);
}

export const kmIn = (text: string): number[] => withUnit(text, KM_UNIT);
export const percentIn = (text: string): number[] => withUnit(text, PERCENT_UNIT);
export const quoteHasKm = (quote: string, n: number): boolean => kmIn(quote).some((v) => same(v, n));
export const quoteHasPercent = (quote: string, n: number): boolean => percentIn(quote).some((v) => same(v, n));

const MONTHS: [string, string[]][] = [
  ['january', ['jan']], ['february', ['feb']], ['march', ['mar']], ['april', ['apr']],
  ['may', []], ['june', ['jun']], ['july', ['jul']], ['august', ['aug']],
  ['september', ['sept', 'sep']], ['october', ['oct']], ['november', ['nov']], ['december', ['dec']],
];
const monthAlt = (i: number): string => {
  const [full, abbr] = MONTHS[i]!;
  return `(?:${[full, ...abbr].join('|')})\\.?`;
};
const ANY_MONTH = `(?:${MONTHS.map((_, i) => monthAlt(i)).join('|')})`;
const ORD = '(?:st|nd|rd|th)?';

/** Whether any quote states the ISO date (YYYY-MM-DD) in a common written form. */
export function quoteHasDate(quotes: string[], isoDate: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return false;
  const year = m[1]!;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return false;
  const mon = monthAlt(month - 1);
  const d = `0?${day}${ORD}`;
  const forms = [
    new RegExp(`(?<![\\w])${mon}\\s+${d},?\\s+${year}(?!\\d)`, 'i'),
    new RegExp(`(?<![\\d])${d}\\s+${mon}\\s+${year}(?!\\d)`, 'i'),
    new RegExp(`(?<![\\d-])${isoDate}(?!\\d)`),
  ];
  const anyDay = [
    new RegExp(`${ANY_MONTH}\\s+\\d{1,2}${ORD},?\\s+${year}(?!\\d)`, 'i'),
    new RegExp(`(?<!\\d)\\d{1,2}${ORD}\\s+${ANY_MONTH}\\s+${year}(?!\\d)`, 'i'),
    new RegExp(`(?<!\\d)${year}-\\d{2}-\\d{2}(?!\\d)`),
  ];
  const texts = quotes.map(normaliseQuote);
  if (texts.some((q) => forms.some((f) => f.test(q)))) return true;
  if (month === 1 && day === 1) {
    // Planned launches given only as a year: accept the year when the quote has no dated form for it.
    return texts.some((q) => quoteHasNumber(q, Number(year)) && !anyDay.some((f) => f.test(q)));
  }
  return false;
}

function pageFor(pages: Map<string, string>, sources: CuratedSource[], sourceId: string, where: string, errors: string[]): string | null {
  if (!sources.some((s) => s.id === sourceId)) { errors.push(`${where}: source ${sourceId} is not registered`); return null; }
  const page = pages.get(sourceId);
  if (page === undefined) { errors.push(`${where}: no page text for source ${sourceId}`); return null; }
  return page;
}

export function verifyInteriors(file: InteriorsFile, pages: Map<string, string>): string[] {
  const errors: string[] = [];
  for (const [body, { layers }] of Object.entries(file.bodies)) {
    for (const layer of layers) {
      const where = `${body}/${layer.id}`;
      const ranges: [string, QuotedRange][] = [['outer', layer.outer], ['inner', layer.inner]];
      for (const [label, r] of ranges) {
        const w = `${where} ${label}`;
        const page = pageFor(pages, file.sources, r.sourceId, w, errors);
        if (page === null) continue;
        if (!quoteOnPage(r.quote, page)) errors.push(`${w}: quote not on page of ${r.sourceId}: "${r.quote}"`);
        for (const key of ['min', 'max'] as const) {
          const v = r[key];
          if (v === 0) continue;
          if (layer.from === 'percent') {
            if (!quoteHasPercent(r.quote, v)) errors.push(`${w}.${key}: ${v} percent not in quote: "${r.quote}"`);
          } else if (!quoteHasKm(r.quote, v)) {
            errors.push(`${w}.${key}: ${v} km not in quote: "${r.quote}"`);
          }
        }
      }
      if (layer.composition) {
        const page = pageFor(pages, file.sources, layer.composition.sourceId, `${where} composition`, errors);
        if (page !== null && !quoteOnPage(layer.composition.quote, page)) {
          errors.push(`${where} composition: quote not on page of ${layer.composition.sourceId}: "${layer.composition.quote}"`);
        }
      }
    }
  }
  return errors;
}

export function verifyMissions(file: MissionsFile, pages: Map<string, string>): string[] {
  const errors: string[] = [];
  for (const [body, { discovery, missions }] of Object.entries(file.bodies)) {
    if (discovery) {
      const where = `${body} discovery`;
      const page = pageFor(pages, file.sources, discovery.sourceId, where, errors);
      if (page !== null) {
        if (!quoteOnPage(discovery.quote, page)) errors.push(`${where}: quote not on page of ${discovery.sourceId}: "${discovery.quote}"`);
        if (discovery.kind === 'discovered' && !quoteHasDate([discovery.quote], discovery.date)) {
          errors.push(`${where}: date ${discovery.date} not in quote: "${discovery.quote}"`);
        }
      }
    }
    for (const m of missions) {
      const where = `${body}/${m.id}`;
      const page = pageFor(pages, file.sources, m.sourceId, where, errors);
      if (page !== null) {
        for (const q of m.quotes) {
          if (!quoteOnPage(q, page)) errors.push(`${where}: quote not on page of ${m.sourceId}: "${q}"`);
        }
      }
      const dates: [string, string | null][] = [['launch', m.launchDate], ['arrival', m.arrivalDate], ['end', m.endDate]];
      for (const [label, date] of dates) {
        if (date !== null && !quoteHasDate(m.quotes, date)) errors.push(`${where}: ${label} ${date} not in any quote`);
      }
    }
  }
  return errors;
}
