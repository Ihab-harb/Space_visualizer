import { cellText, decodeEntities, parseHtml, type HTMLElement } from '../lib/html';

export interface RingRow {
  name: string;
  radiusKm?: number;
  opticalDepth?: number;
  albedo?: number;
  widthKm?: number;
}

export interface RingBand {
  name: string;
  innerKm: number;
  outerKm: number;
  opticalDepth: number;
  albedo: number;
}

/** "0.05 - 0.35" → 0.2; "1e-5" → 1e-5; "~0.4-" → 0.4; "<<0.01" → 0.005; "60,268" → 60268. */
export function parseValue(raw: string): number | undefined {
  let t = decodeEntities(raw).replace(/,/g, '').replace(/~/g, '').trim();
  if (t === '') return undefined;
  if (t.startsWith('<<') || t.startsWith('<')) {
    const n = Number(t.replace(/</g, ''));
    return Number.isFinite(n) ? n / 2 : undefined;
  }
  t = t.replace(/[+-]$/, '').trim();
  const range = /^([\d.]+)\s*-\s*([\d.]+)$/.exec(t);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Cell texts with colspans expanded, so column indexes line up across rows. */
function cellsOf(tr: HTMLElement): string[] {
  return tr.querySelectorAll('th, td').flatMap((c) => {
    const span = Number(c.getAttribute('colspan') ?? '1');
    return [cellText(c), ...Array<string>(Math.max(0, span - 1)).fill('')];
  });
}

export function parseRingSheet(html: string): RingRow[] {
  // Powers of ten: 10<sup>-5</sup> → 1e-5 (other superscripts, like cm<sup>2</sup>, stay as text).
  // Line breaks inside header cells ("Radius<br />(km)") become spaces.
  const cleaned = html.replace(/10\s*<sup>\s*([-\d]+)\s*<\/sup>/gi, '1e$1').replace(/<br\s*\/?>/gi, ' ');
  const root = parseHtml(cleaned);
  const table = root.querySelector('table');
  if (!table) throw new Error('Ring fact sheet: no table found');
  const rows = table.querySelectorAll('tr');
  const header = cellsOf(rows[0]!);
  const col = (prefix: string) => header.findIndex((h) => h.startsWith(prefix));
  const radiusCol = col('Radius (km)');
  const tauCol = col('Optical Depth');
  const albedoCol = col('Albedo');
  const widthCol = col('Width');
  if (radiusCol < 0 || tauCol < 0) throw new Error(`Ring fact sheet: unexpected header ${header.join(' | ')}`);
  const out: RingRow[] = [];
  for (const tr of rows.slice(1)) {
    const cells = cellsOf(tr);
    const name = cells[0];
    if (!name || /equator/i.test(name)) continue;
    const get = (i: number) => (i >= 0 ? parseValue(cells[i] ?? '') : undefined);
    out.push({ name, radiusKm: get(radiusCol), opticalDepth: get(tauCol), albedo: get(albedoCol), widthKm: get(widthCol) });
  }
  return out;
}

export function buildRingBands(rows: RingRow[], opts: { albedoUnit: number; minOpticalDepth: number }): RingBand[] {
  const bands: RingBand[] = [];
  const pending: Array<{ name: string; tau: number; albedo: number }> = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const tau = row.opticalDepth;
    const albedo = (row.albedo ?? 0.3 / opts.albedoUnit) * opts.albedoUnit;
    const inner = /^(.*) inner edge$/.exec(row.name);
    if (inner && row.radiusKm !== undefined) {
      const outerRow = rows.slice(i + 1).find((r) => r.name === `${inner[1]} outer edge`);
      if (outerRow?.radiusKm !== undefined && tau !== undefined) {
        // A gap row (no radius) between the previous band and this one fills the space between them.
        const gap = pending.shift();
        const prev = bands.at(-1);
        if (gap && prev) bands.push({ name: gap.name, innerKm: prev.outerKm, outerKm: row.radiusKm, opticalDepth: gap.tau, albedo: gap.albedo });
        bands.push({ name: inner[1]!, innerKm: row.radiusKm, outerKm: outerRow.radiusKm, opticalDepth: tau, albedo });
      }
      continue;
    }
    if (/ outer edge$/.test(row.name)) continue;
    if (row.radiusKm === undefined && tau !== undefined) {
      pending.push({ name: row.name, tau, albedo });
      continue;
    }
    if (row.radiusKm !== undefined && tau !== undefined && !/gap|ringlet/i.test(row.name)) {
      const half = (row.widthKm ?? 50) / 2;
      bands.push({ name: row.name, innerKm: row.radiusKm - half, outerKm: row.radiusKm + half, opticalDepth: tau, albedo });
    }
  }
  return bands.filter((b) => b.opticalDepth >= opts.minOpticalDepth).sort((a, b) => a.innerKm - b.innerKm);
}

/** Radial RGBA profile (width × 2): alpha from optical depth with sub-texel coverage, colour = tint × albedo. */
export function ringProfile(bands: RingBand[], opts: { width: number; tint: [number, number, number] }): { rgba: Uint8Array; innerKm: number; outerKm: number } {
  const innerKm = Math.min(...bands.map((b) => b.innerKm));
  const outerKm = Math.max(...bands.map((b) => b.outerKm));
  const texelKm = (outerKm - innerKm) / opts.width;
  const rgba = new Uint8Array(opts.width * 2 * 4);
  for (let x = 0; x < opts.width; x++) {
    const r0 = innerKm + x * texelKm;
    const r1 = r0 + texelKm;
    let alpha = 0;
    let bright = 0;
    for (const b of bands) {
      const overlap = Math.max(0, Math.min(r1, b.outerKm) - Math.max(r0, b.innerKm));
      if (overlap <= 0) continue;
      const coverage = overlap / texelKm;
      const a = (1 - Math.exp(-b.opticalDepth)) * coverage;
      alpha = Math.max(alpha, a);
      bright = Math.max(bright, Math.min(1.2, Math.max(0.05, b.albedo / 0.4)));
    }
    for (const row of [0, 1]) {
      const i = (row * opts.width + x) * 4;
      rgba[i] = Math.round(Math.min(1, opts.tint[0] * bright) * 255);
      rgba[i + 1] = Math.round(Math.min(1, opts.tint[1] * bright) * 255);
      rgba[i + 2] = Math.round(Math.min(1, opts.tint[2] * bright) * 255);
      rgba[i + 3] = Math.round(Math.min(1, alpha) * 255);
    }
  }
  return { rgba, innerKm, outerKm };
}
