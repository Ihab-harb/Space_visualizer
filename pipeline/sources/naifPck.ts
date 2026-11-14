import type { RotationModel } from '../../src/core/catalog/schema';

const ASSIGNMENT = /([A-Z][A-Z0-9_]*)\s*(\+?=)\s*(\([^)]*\)|[^\s()]+)/g;

/** Data lines only: a token counts only when it is alone on its line (NAIF rule; the header prose mentions it mid-sentence). */
function dataSection(text: string): string {
  const lines: string[] = [];
  let inData = false;
  for (const line of text.split(/\r?\n/)) {
    const token = line.trim();
    if (token === '\\begindata') inData = true;
    else if (token === '\\begintext') inData = false;
    else if (inData) lines.push(line);
  }
  return lines.join('\n');
}

export function parsePckAssignments(text: string): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const match of dataSection(text).matchAll(ASSIGNMENT)) {
    const name = match[1]!;
    const op = match[2]!;
    const tokens = match[3]!.replace(/^\(|\)$/g, '').split(/[\s,]+/).filter(Boolean);
    if (tokens.some((t) => t.startsWith("'"))) continue; // string-valued variable
    const values = tokens.map((t) => Number(t.replace(/[dD]/, 'e')));
    if (values.some((v) => !Number.isFinite(v))) throw new Error(`PCK: non-numeric value in ${name}`);
    out.set(name, op === '+=' ? [...(out.get(name) ?? []), ...values] : values);
  }
  return out;
}

export function rotationModelFor(pck: Map<string, number[]>, naifId: number): Omit<RotationModel, 'sourceId'> {
  const get = (key: string) => pck.get(`BODY${naifId}_${key}`);
  const poly3 = (key: string): [number, number, number] => {
    const v = get(key);
    if (!v) throw new Error(`PCK: missing BODY${naifId}_${key}`);
    return [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0];
  };
  const system = naifId >= 100 ? Math.floor(naifId / 100) : null;
  const rawAngles = system === null ? [] : (pck.get(`BODY${system}_NUT_PREC_ANGLES`) ?? []);
  const degree = system === null ? 1 : (pck.get(`BODY${system}_MAX_PHASE_DEGREE`)?.[0] ?? 1);
  const group = degree + 1;
  const nutPrecAngles: Array<[number, number, number]> = [];
  for (let i = 0; i + group <= rawAngles.length; i += group) {
    nutPrecAngles.push([rawAngles[i]!, rawAngles[i + 1]!, group > 2 ? rawAngles[i + 2]! : 0]);
  }
  const nutPrecRa = get('NUT_PREC_RA') ?? [];
  const nutPrecDec = get('NUT_PREC_DEC') ?? [];
  const nutPrecPm = get('NUT_PREC_PM') ?? [];
  const longest = Math.max(nutPrecRa.length, nutPrecDec.length, nutPrecPm.length);
  if (longest > nutPrecAngles.length) {
    throw new Error(`PCK: body ${naifId} has ${longest} periodic coefficients but only ${nutPrecAngles.length} angles`);
  }
  return {
    poleRa: poly3('POLE_RA'),
    poleDec: poly3('POLE_DEC'),
    pm: poly3('PM'),
    nutPrecRa,
    nutPrecDec,
    nutPrecPm,
    nutPrecAngles: longest === 0 ? [] : nutPrecAngles,
  };
}

export function radiiFor(pck: Map<string, number[]>, naifId: number): { equatorialRadiusKm: number; polarRadiusKm: number } {
  const r = pck.get(`BODY${naifId}_RADII`);
  if (!r || r.length !== 3) throw new Error(`PCK: missing or malformed BODY${naifId}_RADII`);
  return { equatorialRadiusKm: r[0]!, polarRadiusKm: r[2]! };
}
