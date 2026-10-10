import type { Atmosphere, Magnetosphere } from '../../src/core/details/schema';
import { decodeEntities } from '../lib/html';

export const PLANET_SHEET_IDS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as const;
export type PlanetSheetId = (typeof PLANET_SHEET_IDS)[number];

export const PLANET_ATMOSPHERE_HEADING = /^Atmospheric composition\s*\(([^)]*)\)\s*:?/i;
export const SUN_COMPOSITION_HEADING = /^Photosphere Composition\s*:?/i;

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '⁺',
};

/** The page's visible text with line breaks kept; <sub> contents are inlined (CO<sub>2</sub> -> CO2); <sup> contents become Unicode superscripts (10<sup>6</sup> -> 10⁶). */
export function sheetText(html: string): string {
  const text = html
    .replace(/<sup\b[^>]*>([\s\S]*?)<\/sup>/gi, (_m, inner: string) =>
      inner.replace(/<[^>]*>/g, '').replace(/[0-9+-]/g, (c) => SUPERSCRIPT[c]!))
    .replace(/<\/?sub\b[^>]*>/gi, '')
    .replace(/<\/?(?:br|p|hr|pre|h\d|tr|table|div|li|ul|ol|title|body|head|html)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(text).replace(/\r/g, '');
}

const NAMES: Record<string, string> = {
  H: 'Hydrogen', He: 'Helium', O: 'Oxygen', C: 'Carbon', Ne: 'Neon', N: 'Nitrogen',
  Fe: 'Iron', Mg: 'Magnesium', Si: 'Silicon', S: 'Sulfur', CH4: 'Methane',
};

const SECTION = /^(Major elements|Minor elements\s*\(ppm\)|Major|Minor\s*\(ppm\)|Aerosols)\s*:?\s*(.*)$/i;
const FORMULA_GROUP = /\([A-Z][A-Za-z0-9]*\)/;
const SYMBOL_START = /^[A-Z][A-Za-z0-9]*\s*-\s*[\d.]/;

interface Section {
  kind: 'major' | 'minor' | 'aerosols';
  text: string;
}

function num(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

/** Split on ";" and on commas outside parentheses. */
function splitEntries(joined: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of joined) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ';' || ch === ',') && depth === 0) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter((p) => p !== '');
}

function parseEntry(entry: string): { name: string; formula: string; amount: number; uncertainty: number | null } {
  let m = /^([\d.]+)%\s+(.+?)\s*\(([^)]+)\)$/.exec(entry);
  if (m) return { name: m[2]!, formula: m[3]!, amount: num(m[1]!), uncertainty: null };
  m = /^(.+?)\s*\(([^)]+)\)\s*-?\s*([\d.,]+)\s*%?\s*(?:\(([\d.]+)%?\))?(?:\s*\(varies[^)]*\))?$/.exec(entry);
  if (m) return { name: m[1]!, formula: m[2]!, amount: num(m[3]!), uncertainty: m[4] === undefined ? null : num(m[4]) };
  m = /^([A-Z][A-Za-z0-9]*)\s*-\s*([\d.,]+)\s*%?$/.exec(entry);
  if (m) return { name: NAMES[m[1]!] ?? m[1]!, formula: m[1]!, amount: num(m[2]!), uncertainty: null };
  throw new Error(`Unrecognised atmosphere entry "${entry}"`);
}

/** Insert ";" where one entry runs straight into the next across a line break (Mars "2.59% Argon", Earth "420 Neon"). */
function separateRunOns(joined: string): string {
  return joined.replace(/((?:-|\))\s*[\d.,]+\s*%?(?:\s*\([\d.]+%?\))?)\s+(?=[A-Z])/g, '$1;');
}

export function parseComposition(text: string, heading: RegExp, sourceId: string): Atmosphere | null {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => heading.test(l.trim()));
  if (start < 0) return null;
  const basis = heading.exec(lines[start]!.trim())![1]?.trim() || 'photosphere';
  const block: string[] = [];
  let end = start + 1;
  for (; end < lines.length && lines[end]!.trim() !== ''; end++) block.push(lines[end]!);

  if (heading !== SUN_COMPOSITION_HEADING && !/volume/i.test(basis)) {
    // Not a by-volume list (Mercury column abundances): no gases, the paragraph after the block is the note.
    let p = end;
    while (p < lines.length && lines[p]!.trim() === '') p++;
    const para: string[] = [];
    for (; p < lines.length && lines[p]!.trim() !== ''; p++) para.push(lines[p]!.trim());
    const noteText = para.join(' ').replace(/\s+/g, ' ').replace(/^\(/, '').replace(/\)$/, '').trim();
    return { basis, major: [], minor: [], note: noteText ? { text: noteText, sourceId } : null };
  }

  const sections: Section[] = [];
  const notes: string[] = [];
  for (const raw of block) {
    const line = raw.trim();
    const s = SECTION.exec(line);
    if (s) {
      const label = s[1]!.toLowerCase();
      const kind = label.startsWith('aerosols') ? 'aerosols' : label.startsWith('minor') ? 'minor' : 'major';
      sections.push({ kind, text: s[2]!.trim() });
    } else if (sections.length > 0 && (FORMULA_GROUP.test(line) || SYMBOL_START.test(line))) {
      sections[sections.length - 1]!.text += ` ${line}`;
    } else if (line !== '') {
      notes.push(line);
    }
  }

  const major: Atmosphere['major'] = [];
  const minor: Atmosphere['minor'] = [];
  for (const section of sections) {
    if (section.kind === 'aerosols') {
      notes.push(`Aerosols: ${section.text.replace(/\s+/g, ' ')}`);
      continue;
    }
    for (const entry of splitEntries(separateRunOns(section.text.replace(/\s+/g, ' ')))) {
      const e = parseEntry(entry);
      if (section.kind === 'major') major.push({ ...e, unit: '%', sourceId });
      else minor.push({ ...e, unit: 'ppm', sourceId });
    }
  }
  const note = notes.length > 0 ? { text: notes.join('. '), sourceId } : null;
  return { basis, major, minor, note };
}

type Dipole = Extract<Magnetosphere, { kind: 'dipole' }>;

function round(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

export function parseMagnetosphere(text: string, sourceId: string): Dipole | null {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /Magnetosphere\s*$/i.test(l.trim()));
  if (start < 0) return null;
  const block: string[] = [];
  // 16 non-blank lines: tag-to-newline conversion leaves variable runs of blank lines after headings.
  for (let i = start + 1; i < lines.length && block.length < 16; i++) {
    const line = lines[i]!.trim();
    if (line === '') continue;
    if (/Atmosphere(?:\s*\([^)]*\))?\s*$/i.test(line)) break;
    block.push(line);
  }
  const joined = block.join('\n');
  const find = (re: RegExp): RegExpExecArray | null => re.exec(joined);
  const value = (m: RegExpExecArray | null) => (m ? { value: num(m[1]!), sourceId } : null);

  const strength = value(find(/Dipole field strength:\s*([\d.]+)/i));
  if (!strength) throw new Error('Magnetosphere block has no dipole field strength');
  const radius = find(/defined\s+(?:here\s+)?to\s+be\s+([\d,]+)\s*km/i);
  if (!radius) throw new Error('Magnetosphere block has no reference radius');
  const field = find(/Surface\s*\(1\s*R\S*\)\s*field strength:\s*~?([\d.]+)\s*-\s*~?([\d.]+)\s*Gauss/i);
  const pole = find(/Geocentric Dipole:\s*([\d.]+)\s*([NS])\s*,\s*([\d.]+)\s*([EW])/i);
  return {
    kind: 'dipole',
    strengthGaussR3: strength,
    tiltDeg: value(find(/Dipole tilt to rotational axis:\s*([\d.]+)/i)),
    tiltLongitudeDeg: value(find(/Longitude of tilt:\s*([\d.]+)/i)),
    dipolePole: pole
      ? {
          latDeg: pole[2] === 'S' ? -num(pole[1]!) : num(pole[1]!),
          lonDegE: pole[4] === 'W' ? round(360 - num(pole[3]!)) : num(pole[3]!),
          sourceId,
        }
      : null,
    offsetRadii: value(find(/Dipole offset:\s*([\d.]+)\s*R/i)),
    referenceRadiusKm: { value: num(radius[1]!), sourceId },
    surfaceFieldGauss: field ? { min: num(field[1]!), max: num(field[2]!), sourceId } : null,
  };
}

export function parseSunField(text: string, sourceId: string): Extract<Magnetosphere, { kind: 'other' }> {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^Solar Magnetic Field\s*$/i.test(l.trim()));
  if (start < 0) throw new Error('Sun fact sheet: no Solar Magnetic Field block');
  const parts: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line === '' || /^Typical/i.test(line)) {
      if (parts.length > 0 && line === '') break;
      continue;
    }
    const m = /^(.+?):\s*([\d.]+)(?:\s*-\s*([\d.]+))?\s*Gauss\b/.exec(line);
    if (!m) break;
    const name = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1).toLowerCase();
    parts.push(`${name} ${m[3] ? `${m[2]}–${m[3]}` : m[2]} G`);
  }
  if (parts.length === 0) throw new Error('Sun fact sheet: no field strengths found');
  return { kind: 'other', note: { text: `Typical field strengths (Gauss): ${parts.join('; ')}`, sourceId } };
}
