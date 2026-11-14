import { parsePckAssignments } from './naifPck';

/** NAIF id -> GM in km^3/s^2, from the BODY<id>_GM assignments of a gm_*.tpc kernel (D and E exponents both read). */
export function parseGmKernel(text: string): Map<number, number> {
  const out = new Map<number, number>();
  for (const [name, values] of parsePckAssignments(text)) {
    const m = /^BODY(\d+)_GM$/.exec(name);
    if (m && values.length === 1) out.set(Number(m[1]), values[0]!);
  }
  return out;
}
