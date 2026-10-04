import { cellText, decodeEntities, parseHtml, type HTMLElement } from '../lib/html';

export const APPROX_ROWS = ['Mercury', 'Venus', 'EM Bary', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'] as const;
export type ApproxRow = (typeof APPROX_ROWS)[number];

export interface KeplerRow { a: number; e: number; I: number; L: number; varpi: number; Omega: number }
export interface ExtraTerms { b: number; c: number; s: number; f: number }
export interface ErrorFigure { longitudeArcsec: number; latitudeArcsec: number; distanceKm: number }
type ElementTable = Record<ApproxRow, { elements: KeplerRow; rates: KeplerRow }>;

export interface ApproxPosData {
  table1: ElementTable;
  table2a: ElementTable;
  table2b: Partial<Record<ApproxRow, ExtraTerms>>;
  nominalErrors: Record<ApproxRow, { table1: ErrorFigure; table2: ErrorFigure }>;
}

const ROW_LINE = /^(Mercury|Venus|EM Bary|Mars|Jupiter|Saturn|Uranus|Neptune)\s+(?=[-\d])/;

function preAfterHeading(root: HTMLElement, heading: string): string {
  const h = root.querySelectorAll('h4').find((el) => cellText(el) === heading);
  if (!h) throw new Error(`approx_pos: heading "${heading}" not found`);
  let el = h.nextElementSibling;
  while (el && el.tagName !== 'PRE') el = el.nextElementSibling;
  if (!el) throw new Error(`approx_pos: no <pre> after "${heading}"`);
  return decodeEntities(el.rawText);
}

function numbers(text: string, count: number, context: string): number[] {
  const parts = text.trim().split(/\s+/).map(Number);
  if (parts.length !== count || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`${context}: expected ${count} numbers, got "${text.trim()}"`);
  }
  return parts;
}

const toKepler = (n: number[]): KeplerRow => ({ a: n[0]!, e: n[1]!, I: n[2]!, L: n[3]!, varpi: n[4]!, Omega: n[5]! });

function requireAll<T>(rows: Partial<Record<ApproxRow, T>>, label: string): Record<ApproxRow, T> {
  for (const name of APPROX_ROWS) if (!rows[name]) throw new Error(`${label}: missing row "${name}"`);
  return rows as Record<ApproxRow, T>;
}

function parseElementTable(pre: string, label: string): ElementTable {
  const lines = pre.split(/\r?\n/);
  const rows: Partial<ElementTable> = {};
  for (let i = 0; i < lines.length; i++) {
    const match = ROW_LINE.exec(lines[i]!);
    if (!match) continue;
    const name = match[1] as ApproxRow;
    rows[name] = {
      elements: toKepler(numbers(lines[i]!.slice(name.length), 6, `${label} ${name} elements`)),
      rates: toKepler(numbers(lines[i + 1] ?? '', 6, `${label} ${name} rates`)),
    };
    i += 1;
  }
  return requireAll(rows, label);
}

function parseExtraTerms(pre: string): Partial<Record<ApproxRow, ExtraTerms>> {
  const rows: Partial<Record<ApproxRow, ExtraTerms>> = {};
  for (const line of pre.split(/\r?\n/)) {
    const match = ROW_LINE.exec(line);
    if (!match) continue;
    const name = match[1] as ApproxRow;
    const [b, c, s, f] = numbers(line.slice(name.length), 4, `Table 2b ${name}`);
    rows[name] = { b: b!, c: c!, s: s!, f: f! };
  }
  if (Object.keys(rows).length === 0) throw new Error('Table 2b: no rows found');
  return rows;
}

function parseNominalErrors(root: HTMLElement): ApproxPosData['nominalErrors'] {
  const table = root.querySelector('table.planet-approx-pos-errors');
  if (!table) throw new Error('approx_pos: accuracy table not found');
  const rows: Partial<ApproxPosData['nominalErrors']> = {};
  for (const tr of table.querySelectorAll('tbody tr')) {
    const th = tr.querySelector('th');
    const name = th ? APPROX_ROWS.find((n) => cellText(th).startsWith(n)) : undefined;
    if (!name) continue;
    const v = tr.querySelectorAll('td').map((td) => Number(cellText(td)));
    if (v.length !== 6 || v.some((n) => !Number.isFinite(n))) throw new Error(`accuracy table: bad row for ${name}`);
    rows[name] = {
      table1: { longitudeArcsec: v[0]!, latitudeArcsec: v[1]!, distanceKm: v[2]! * 1000 },
      table2: { longitudeArcsec: v[3]!, latitudeArcsec: v[4]!, distanceKm: v[5]! * 1000 },
    };
  }
  return requireAll(rows, 'accuracy table');
}

export function parseApproxPos(html: string): ApproxPosData {
  const root = parseHtml(html);
  return {
    table1: parseElementTable(preAfterHeading(root, 'Table 1'), 'Table 1'),
    table2a: parseElementTable(preAfterHeading(root, 'Table 2a'), 'Table 2a'),
    table2b: parseExtraTerms(preAfterHeading(root, 'Table 2b')),
    nominalErrors: parseNominalErrors(root),
  };
}
