import type { MissionOutcome, MissionType } from '../../src/core/details/schema';
import { decodeEntities } from '../lib/html';

/**
 * A curated source. Official pages (the default) must sit on an official host. A `kind: 'paper'` source is a peer-reviewed article
 * (ADR 0009): `url` is its DOI link, `publisher` the journal, and `quoteUrl` an optional open copy to check quotes against.
 * `kind`, `doi`, `journal` and `quoteUrl` live in the curated file only; the registered Source keeps the five base fields.
 */
export interface CuratedSource {
  id: string; title: string; publisher: string; url: string; license: string;
  kind?: 'official' | 'paper'; doi?: string; journal?: string; quoteUrl?: string;
}
export interface Quoted { sourceId: string; quote: string }
export interface QuotedRange extends Quoted {
  min: number; max: number;
  /** Overrides the layer's `from` for this bound only. */
  from?: 'radius' | 'depth' | 'percent';
}
export interface CuratedLayer {
  id: string; name: string; from: 'radius' | 'depth' | 'percent';
  /**
   * How the size is known. Absent or 'cited': both bounds from official sources. 'estimate': at least one bound from a paper source
   * (the layer is then an estimate). 'illustrative': no bounds; the size is shared between the cited neighbours and no number is shown.
   */
  sizeKind?: 'cited' | 'estimate' | 'illustrative';
  /** True when any value of the layer (size, state or composition) comes from a paper. Implied by sizeKind 'estimate'. */
  estimate?: boolean;
  /** Radii in km, depths in km below the surface, or percent of the body's radius from the centre. Required unless sizeKind is 'illustrative'. */
  outer?: QuotedRange; inner?: QuotedRange;
  state: 'solid' | 'liquid' | 'gas' | 'plasma' | 'unknown';
  /** A sentence on a registered page that states the layer's state; when present, the state is shown with this citation. */
  stateSource?: Quoted;
  composition: (Quoted & { text: string }) | null;
  uncertain: boolean;
  /**
   * A sentence that says the layer's outer boundary has no sharp edge (a dilute or diffuse core). The cutaway then draws that
   * boundary as an illustrative soft band with no line. Not allowed on the outermost layer (its outer edge is the surface).
   */
  gradual?: Quoted;
}

/** Words a `gradual` quote must contain, so the sentence really describes a boundary without a sharp edge. */
export const GRADUAL_WORDS = ['gradual', 'dilute', 'diffuse', 'fuzzy', 'no clear separation', 'no sharp'] as const;
export interface CuratedMission { id: string; name: string; agency: string; type: MissionType; launchDate: string; arrivalDate: string | null; endDate: string | null; outcome: MissionOutcome; sourceId: string; quotes: string[] }
export type CuratedDiscovery = (Quoted & { kind: 'antiquity' }) | (Quoted & { kind: 'discovered'; by: string; date: string; method: string });
export interface InteriorsFile {
  sources: CuratedSource[];
  /** `magneticField`: a sentence about the body's field (shown in the Magnetic field section), kept here with the other quoted body facts. */
  bodies: Record<string, { layers: CuratedLayer[]; magneticField?: Quoted & { text: string } }>;
}
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
/** Journals whose papers may be cited as sources (ADR 0009), by canonical full title. */
export const TRUSTED_JOURNALS = [
  'Nature', 'Science', 'Nature Astronomy', 'Journal of Geophysical Research: Planets', 'Geophysical Research Letters', 'Icarus',
  'The Planetary Science Journal', 'Astronomy & Astrophysics', 'The Astrophysical Journal',
  'Annual Review of Earth and Planetary Sciences', 'Space Science Reviews',
] as const;
/** Other spellings accepted in `journal` (lower case), each mapped to its canonical title. */
const JOURNAL_ALIASES: Record<string, (typeof TRUSTED_JOURNALS)[number]> = {
  'jgr planets': 'Journal of Geophysical Research: Planets',
  'jgr: planets': 'Journal of Geophysical Research: Planets',
  'jgr-planets': 'Journal of Geophysical Research: Planets',
  'journal of geophysical research planets': 'Journal of Geophysical Research: Planets',
  'a&a': 'Astronomy & Astrophysics',
  'astronomy and astrophysics': 'Astronomy & Astrophysics',
  'apj': 'The Astrophysical Journal',
  'astrophysical journal': 'The Astrophysical Journal',
  'psj': 'The Planetary Science Journal',
  'planetary science journal': 'The Planetary Science Journal',
  'grl': 'Geophysical Research Letters',
};
/** The canonical title of a trusted journal given its title or a known alias (case-insensitive), else null. */
export function canonicalJournal(name: string | undefined): (typeof TRUSTED_JOURNALS)[number] | null {
  const key = name?.trim().toLowerCase();
  if (!key) return null;
  return TRUSTED_JOURNALS.find((j) => j.toLowerCase() === key) ?? JOURNAL_ALIASES[key] ?? null;
}
/** Hosts of open copies of a published paper that a quote may be checked against (a host or any subdomain). */
export const OPEN_COPY_HOSTS = ['arxiv.org', 'ncbi.nlm.nih.gov', 'ui.adsabs.harvard.edu'] as const;
const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/;

/** The page a source's quotes are checked against: the open copy when the source names one, else its url. */
export const quotePageUrl = (s: CuratedSource): string => s.quoteUrl ?? s.url;
export const isPaper = (s: CuratedSource): boolean => s.kind === 'paper';

const onHost = (host: string, hosts: readonly string[]): boolean => hosts.some((h) => host === h || host.endsWith(`.${h}`));

const isHttps = (url: string): boolean => { try { return new URL(url).protocol === 'https:'; } catch { return false; } };

function hostOf(url: string): string | null {
  try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
}

function checkPaperSource(s: CuratedSource, errors: string[]): void {
  if (s.doi === undefined || !DOI_PATTERN.test(s.doi)) errors.push(`source ${s.id}: a paper needs a DOI like 10.1038/xxxx`);
  else if (s.url !== `https://doi.org/${s.doi}`) errors.push(`source ${s.id}: url must be https://doi.org/${s.doi}`);
  const journal = canonicalJournal(s.journal);
  if (journal === null) {
    errors.push(`source ${s.id}: journal "${s.journal ?? ''}" is not in the trusted list (${TRUSTED_JOURNALS.join(', ')})`);
  } else if (s.publisher !== journal) {
    errors.push(`source ${s.id}: publisher must equal the canonical journal title "${journal}"`);
  }
  if (s.quoteUrl !== undefined) {
    if (!isHttps(s.quoteUrl)) errors.push(`source ${s.id}: quoteUrl must use https`);
    const host = hostOf(s.quoteUrl);
    if (host === null || !onHost(host, OPEN_COPY_HOSTS)) errors.push(`source ${s.id}: quoteUrl host ${host ?? s.quoteUrl} is not an open-copy host (${OPEN_COPY_HOSTS.join(', ')})`);
  }
}

export function checkSources(sources: CuratedSource[], errors: string[]): void {
  const seen = new Set<string>();
  for (const s of sources) {
    if (seen.has(s.id)) errors.push(`duplicate source id ${s.id}`);
    seen.add(s.id);
    if (isPaper(s)) { checkPaperSource(s, errors); continue; }
    for (const key of ['doi', 'journal', 'quoteUrl'] as const) {
      if (s[key] !== undefined) errors.push(`source ${s.id}: only a paper source may carry ${key} (set kind: "paper")`);
    }
    if (!isHttps(s.url)) errors.push(`source ${s.id}: url must use https`);
    const host = hostOf(s.url);
    if (host === null || !onHost(host, OFFICIAL_HOSTS)) {
      errors.push(`source ${s.id} is not on an official host: ${host ?? s.url}`);
    }
  }
}

export function checkQuote(quote: string, page: string, sourceId: string, where: string, errors: string[]): void {
  if (!quoteOnPage(quote, page)) errors.push(`${where}: quote not on page of ${sourceId}: "${quote}"`);
  const words = normaliseQuote(quote).split(' ').filter(Boolean).length;
  if (words < MIN_QUOTE_WORDS) errors.push(`${where}: quote too short (${words} words): "${quote}"`);
}

export function pageFor(pages: Map<string, string>, sources: CuratedSource[], sourceId: string, where: string, errors: string[]): string | null {
  if (!sources.some((s) => s.id === sourceId)) { errors.push(`${where}: source ${sourceId} is not registered`); return null; }
  const page = pages.get(sourceId);
  if (page === undefined) { errors.push(`${where}: no page text for source ${sourceId}`); return null; }
  return page;
}

export function verifyInteriors(file: InteriorsFile, pages: Map<string, string>): string[] {
  const errors: string[] = [];
  checkSources(file.sources, errors);
  const paperIds = new Set(file.sources.filter(isPaper).map((s) => s.id));
  for (const [body, { layers, magneticField }] of Object.entries(file.bodies)) {
    if (magneticField) {
      const where = `${body} magneticField`;
      const page = pageFor(pages, file.sources, magneticField.sourceId, where, errors);
      if (page !== null) checkQuote(magneticField.quote, page, magneticField.sourceId, where, errors);
    }
    for (const [index, layer] of layers.entries()) {
      const where = `${body}/${layer.id}`;
      if (layer.gradual) {
        const w = `${where} gradual`;
        if (index === 0) errors.push(`${w}: the outermost layer's outer edge is the surface, not a gradual boundary`);
        const page = pageFor(pages, file.sources, layer.gradual.sourceId, w, errors);
        if (page !== null) checkQuote(layer.gradual.quote, page, layer.gradual.sourceId, w, errors);
        const q = normaliseQuote(layer.gradual.quote).toLowerCase();
        if (!GRADUAL_WORDS.some((word) => q.includes(word))) errors.push(`${w}: the quote does not describe a gradual boundary (${GRADUAL_WORDS.join(', ')}): "${layer.gradual.quote}"`);
      }
      const kind = layer.sizeKind ?? 'cited';
      const ranges: [string, QuotedRange][] = [];
      if (kind === 'illustrative') {
        if (layer.outer || layer.inner) errors.push(`${where}: an illustrative layer must not carry bounds`);
      } else if (!layer.outer || !layer.inner) {
        errors.push(`${where}: a ${kind} layer needs outer and inner bounds`);
      } else {
        ranges.push(['outer', layer.outer], ['inner', layer.inner]);
        const paperBound = ranges.some(([, r]) => paperIds.has(r.sourceId));
        if (paperBound && kind !== 'estimate') errors.push(`${where}: sized by a paper source: sizeKind must be "estimate"`);
        if (kind === 'estimate' && !paperBound) errors.push(`${where}: sizeKind "estimate" needs a bound from a paper source`);
      }
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
      if (layer.stateSource) {
        const page = pageFor(pages, file.sources, layer.stateSource.sourceId, `${where} stateSource`, errors);
        if (page !== null) checkQuote(layer.stateSource.quote, page, layer.stateSource.sourceId, `${where} stateSource`, errors);
      }
      if (layer.composition) {
        const page = pageFor(pages, file.sources, layer.composition.sourceId, `${where} composition`, errors);
        if (page !== null) checkQuote(layer.composition.quote, page, layer.composition.sourceId, `${where} composition`, errors);
      }
      const citedIds = [layer.outer?.sourceId, layer.inner?.sourceId, layer.stateSource?.sourceId, layer.composition?.sourceId, layer.gradual?.sourceId];
      if (citedIds.some((id) => id !== undefined && paperIds.has(id)) && layer.estimate !== true) {
        errors.push(`${where}: cites a paper source: estimate must be true`);
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
