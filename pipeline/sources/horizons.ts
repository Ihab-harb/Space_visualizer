import type { Vec3 } from '../../src/core/math/vec3';

export const HORIZONS_API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

/** System barycentres; JPL's approximate elements are compared against these. '3' = Earth-Moon barycentre. */
export const REFERENCE_BODIES = [
  { body: 'mercury', command: '1' },
  { body: 'venus', command: '2' },
  { body: 'earth', command: '3' },
  { body: 'mars', command: '4' },
  { body: 'jupiter', command: '5' },
  { body: 'saturn', command: '6' },
  { body: 'uranus', command: '7' },
  { body: 'neptune', command: '8' },
] as const;

/** Six dates inside Table 1 (1800-2050) and three outside it but inside Table 2 (3000 BC - AD 3000). */
export const REFERENCE_JDS = [1355795.0, 1721423.5, 2385000.5, 2415020.0, 2433282.5, 2451545.0, 2461317.5, 2469807.5, 2816795.0];

export interface HorizonsReference {
  retrievedAt: string;
  query: Record<string, string>;
  samples: Array<{ body: string; command: string; jdTdb: number; positionKm: [number, number, number] }>;
}

export const REFERENCE_QUERY: Record<string, string> = {
  CENTER: "'500@10'",
  REF_PLANE: "'ECLIPTIC'",
  REF_SYSTEM: "'ICRF'",
  EPHEM_TYPE: "'VECTORS'",
  VEC_TABLE: "'1'",
  OUT_UNITS: "'KM-S'",
  TIME_TYPE: "'TDB'",
  CSV_FORMAT: "'YES'",
};

export function horizonsVectorUrl(command: string, jdTdb: number): string {
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: `'${command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    TLIST: `'${jdTdb}'`,
    TLIST_TYPE: "'JD'",
    ...REFERENCE_QUERY,
  });
  return `${HORIZONS_API}?${params.toString()}`;
}

/** Extract X, Y, Z (km) from the first line between $$SOE and $$EOE of a CSV vector table. */
export function parseHorizonsVector(result: string): Vec3 {
  const block = result.split('$$SOE')[1]?.split('$$EOE')[0];
  if (!block) throw new Error('Horizons result has no $$SOE/$$EOE block');
  const parts = block.trim().split('\n')[0]!.split(',').map((s) => s.trim());
  const xyz = [Number(parts[2]), Number(parts[3]), Number(parts[4])] as const;
  if (xyz.some((n) => !Number.isFinite(n))) throw new Error(`Horizons vector line not numeric: ${block.trim()}`);
  return xyz;
}
