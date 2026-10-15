import type { MissionOutcome, MissionType } from '../../src/core/details/schema';
import { decodeEntities } from '../lib/html';

export interface CuratedSource { id: string; title: string; publisher: string; url: string; license: string }
export interface Quoted { sourceId: string; quote: string }
export interface QuotedRange extends Quoted {
  min: number; max: number;
  /** Overrides the layer's `from` for this bound only. */
  from?: 'radius' | 'depth' | 'percent';
}
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

// A unit followed by a letter, digit, slash, caret or superscript is a different unit (km/s, km², km^3).
const KM_UNIT = /^\s*(?:km|kilometers?|kilometres?)(?![A-Za-z0-9/^²³¹⁰-⁹])/i;
const PERCENT_UNIT = /^\s*(?:%|percent(?![A-Za-z]))/i;

const FUNCTION_WORDS = new Set([
  'on', 'of', 'the', 'until', 'from', 'by', 'since', 'and', 'to', 'after', 'before', 'in', 'through', 'between',
  'at', 'around', 'about', 'till', 'or', 'was', 'is', 'are', 'were', 'a', 'an', 'for', 'with', 'within', 'up',
  'near', 'over', 'under', 'than', 'roughly', 'approximately', 'nearly', 'almost', 'some', 'only',
]);

/** Whether the text before a number ends in a name or designation ("Apollo ", "Voyager-") that owns the number. */
function followsDesignation(prefix: string): boolean {
  const trimmed = prefix.replace(/ $/, '');
  if (trimmed.endsWith('-')) return true;
  const word = /([A-Za-z]+)$/.exec(trimmed)?.[1];
  return word !== undefined && /^[A-Z]/.test(word) && !FUNCTION_WORDS.has(word.toLowerCase());
}

/** Whether `n` and `next` are the two ends of one range, judged from the words around them. */
function isRange(t: string, n: Num, next: Num): boolean {
  const gap = t.slice(n.end, next.start);
  const prefix = t.slice(0, n.start);
  if (/^\s*-\s*$/.test(gap)) return !followsDesignation(prefix);
  if (/^\s+and\s+$/i.test(gap)) return /\bbetween\s+$/i.test(prefix);
  if (/^\s+to\s+$/i.test(gap)) return /\b(?:from|between)\s+$/i.test(prefix) || !followsDesignation(prefix);
  return false;
}

/** Numbers followed by the unit, or the first number of a range whose second number is. */
function withUnit(text: string, unit: RegExp): number[] {
  const t = normaliseQuote(text);
  const nums = scan(t);
  const hit: boolean[] = new Array<boolean>(nums.length).fill(false);
  for (let i = nums.length - 1; i >= 0; i--) {
    const n = nums[i]!;
    if (unit.test(t.slice(n.end))) { hit[i] = true; continue; }
    const next = nums[i + 1];
    if (next && hit[i + 1] && isRange(t, n, next)) hit[i] = true;
  }
  return nums.filter((_, i) => hit[i]).map((n) => n.value);
}

/** Numbers listed right after a "(km)" table label: "Core radius (km) 1830 ** 3485". Only whitespace and "*" footnote marks may separate them. */
function afterKmLabel(text: string): number[] {
  const t = normaliseQuote(text);
  const out: number[] = [];
  for (const m of t.matchAll(/\(km\)((?:\s+(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?![\d.,/^])(?:\s*\*+)?)+)/gi)) {
    out.push(...numbersIn(m[1]!.replace(/\*/g, ' ')));
  }
  return out;
}

export const kmIn = (text: string): number[] => [...withUnit(text, KM_UNIT), ...afterKmLabel(text)];
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

export interface DateOptions {
  /** Accept the bare year for a `-01-01` date. Only for the launch date of a planned mission. */
  yearOnly?: boolean;
}

/** Whether any quote states the ISO date (YYYY-MM-DD) in a common written form. */
export function quoteHasDate(quotes: string[], isoDate: string, opts: DateOptions = {}): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return false;
  const year = m[1]!;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return false;
  const mon = monthAlt(month - 1);
  const d = `0?${day}${ORD}`;
  const monthFirst = new RegExp(`(?<!\\w)${mon}\\s+${d},?\\s+${year}(?!\\d)`, 'i');
  const dayFirst = new RegExp(`(?<!\\d)${d}\\s+${mon}\\s+${year}(?!\\d)`, 'gi');
  const iso = new RegExp(`(?<![\\d-])${isoDate}(?!\\d)`);
  const texts = quotes.map(normaliseQuote);
  for (const q of texts) {
    if (monthFirst.test(q) || iso.test(q)) return true;
    for (const hit of q.matchAll(dayFirst)) {
      // "Voyager 2 August 1977" is mission 2, not the 2nd.
      if (!followsDesignation(q.slice(0, hit.index))) return true;
    }
  }
  if (opts.yearOnly && month === 1 && day === 1) {
    // A planned launch given only as a year: the year must stand alone, with no month beside it.
    const dated = [
      new RegExp(`${ANY_MONTH}\\s+(?:\\d{1,2}${ORD},?\\s+)?${year}(?!\\d)`, 'i'),
      new RegExp(`(?<!\\d)(?:\\d{1,2}${ORD}\\s+)?${ANY_MONTH}\\s+${year}(?!\\d)`, 'i'),
      new RegExp(`(?<!\\d)${year}\\s+${ANY_MONTH}`, 'i'),
      new RegExp(`(?<!\\d)${year}-\\d{2}`),
    ];
    return texts.some((q) => quoteHasNumber(q, Number(year)) && !dated.some((f) => f.test(q)));
  }
  return false;
}

export const OFFICIAL_HOSTS = ['nasa.gov', 'usgs.gov', 'esa.int', 'jaxa.jp', 'isro.gov.in', 'cnsa.gov.cn'] as const;
export const MIN_QUOTE_WORDS = 6;

function hostOf(url: string): string | null {
  try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
}

function checkSources(sources: CuratedSource[], errors: string[]): void {
  const seen = new Set<string>();
  for (const s of sources) {
    if (seen.has(s.id)) errors.push(`duplicate source id ${s.id}`);
    seen.add(s.id);
    const host = hostOf(s.url);
    if (host === null || !OFFICIAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
      errors.push(`source ${s.id} is not on an official host: ${host ?? s.url}`);
    }
  }
}

function checkQuote(quote: string, page: string, sourceId: string, where: string, errors: string[]): void {
  if (!quoteOnPage(quote, page)) errors.push(`${where}: quote not on page of ${sourceId}: "${quote}"`);
  const words = normaliseQuote(quote).split(' ').filter(Boolean).length;
  if (words < MIN_QUOTE_WORDS) errors.push(`${where}: quote too short (${words} words): "${quote}"`);
}

function pageFor(pages: Map<string, string>, sources: CuratedSource[], sourceId: string, where: string, errors: string[]): string | null {
  if (!sources.some((s) => s.id === sourceId)) { errors.push(`${where}: source ${sourceId} is not registered`); return null; }
  const page = pages.get(sourceId);
  if (page === undefined) { errors.push(`${where}: no page text for source ${sourceId}`); return null; }
  return page;
}

export function verifyInteriors(file: InteriorsFile, pages: Map<string, string>): string[] {
  const errors: string[] = [];
  checkSources(file.sources, errors);
  for (const [body, { layers }] of Object.entries(file.bodies)) {
    for (const layer of layers) {
      const where = `${body}/${layer.id}`;
      const ranges: [string, QuotedRange][] = [['outer', layer.outer], ['inner', layer.inner]];
      for (const [label, r] of ranges) {
        const w = `${where} ${label}`;
        const page = pageFor(pages, file.sources, r.sourceId, w, errors);
        if (page === null) continue;
        checkQuote(r.quote, page, r.sourceId, w, errors);
        for (const key of ['min', 'max'] as const) {
          const v = r[key];
          if (v === 0) continue;
          if ((r.from ?? layer.from) === 'percent') {
            if (!quoteHasPercent(r.quote, v)) errors.push(`${w}.${key}: ${v} percent not in quote: "${r.quote}"`);
          } else if (!quoteHasKm(r.quote, v)) {
            errors.push(`${w}.${key}: ${v} km not in quote: "${r.quote}"`);
          }
        }
      }
      if (layer.composition) {
        const page = pageFor(pages, file.sources, layer.composition.sourceId, `${where} composition`, errors);
        if (page !== null) checkQuote(layer.composition.quote, page, layer.composition.sourceId, `${where} composition`, errors);
      }
    }
  }
  return errors;
}

export function verifyMissions(file: MissionsFile, pages: Map<string, string>): string[] {
  const errors: string[] = [];
  checkSources(file.sources, errors);
  for (const [body, { discovery, missions }] of Object.entries(file.bodies)) {
    if (discovery) {
      const where = `${body} discovery`;
      const page = pageFor(pages, file.sources, discovery.sourceId, where, errors);
      if (page !== null) {
        checkQuote(discovery.quote, page, discovery.sourceId, where, errors);
        if (discovery.kind === 'discovered' && !quoteHasDate([discovery.quote], discovery.date)) {
          errors.push(`${where}: date ${discovery.date} not in quote: "${discovery.quote}"`);
        }
      }
    }
    for (const m of missions) {
      const where = `${body}/${m.id}`;
      const page = pageFor(pages, file.sources, m.sourceId, where, errors);
      if (page !== null) {
        for (const q of m.quotes) checkQuote(q, page, m.sourceId, where, errors);
      }
      const dates: [string, string | null][] = [['launch', m.launchDate], ['arrival', m.arrivalDate], ['end', m.endDate]];
      for (const [label, date] of dates) {
        const yearOnly = label === 'launch' && m.outcome === 'planned';
        if (date !== null && !quoteHasDate(m.quotes, date, { yearOnly })) errors.push(`${where}: ${label} ${date} not in any quote`);
      }
    }
  }
  return errors;
}
