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
  // Earth's body centre (not the barycentre): the Moon table's centre is Earth's centre.
  { body: 'earth-centre', command: '399' },
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

const MOON_QUERY = { ...REFERENCE_QUERY, CENTER: "'500@399'" };

/** Geocentric Moon vectors (ecliptic J2000, TDB) for [start, stop] at a fixed step. */
export function moonChunkUrl(startJdTdb: number, stopJdTdb: number, stepMinutes: number): string {
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: "'301'",
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    START_TIME: `'JD ${startJdTdb}'`,
    STOP_TIME: `'JD ${stopJdTdb}'`,
    STEP_SIZE: `'${stepMinutes} m'`,
    ...MOON_QUERY,
  });
  return `${HORIZONS_API}?${params.toString()}`;
}

/** Geocentric Moon vectors at a list of Julian dates (TDB). */
export function moonListUrl(jdsTdb: readonly number[]): string {
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: "'301'",
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    TLIST: `'${jdsTdb.join(' ')}'`,
    TLIST_TYPE: "'JD'",
    ...MOON_QUERY,
  });
  return `${HORIZONS_API}?${params.toString()}`;
}

/** Every row between $$SOE and $$EOE of a CSV vector table: JD (TDB) and X, Y, Z in km. */
export function parseHorizonsVectorTable(result: string): Array<{ jdTdb: number; positionKm: Vec3 }> {
  const block = result.split('$$SOE')[1]?.split('$$EOE')[0];
  if (!block) throw new Error('Horizons result has no $$SOE/$$EOE block');
  return block
    .trim()
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const parts = line.split(',').map((x) => x.trim());
      const nums = [Number(parts[0]), Number(parts[2]), Number(parts[3]), Number(parts[4])];
      if (nums.some((n) => !Number.isFinite(n))) throw new Error(`Horizons vector line not numeric: ${line}`);
      return { jdTdb: nums[0]!, positionKm: [nums[1]!, nums[2]!, nums[3]!] as Vec3 };
    });
}
