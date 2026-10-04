import type { FactKey } from '../../src/core/catalog/facts';
import type { ApproxTable, Body, BodiesFile, PlanetApproxOrbit, Region, Render, RegionsFile, SourcedValue, SourcesFile } from '../../src/core/catalog/schema';
import { planetApproxState, selectTable } from '../../src/core/ephemeris/planetApprox';
import { ARCSEC } from '../../src/core/math/angles';
import { angleBetween, length, type Vec3 } from '../../src/core/math/vec3';
import { calendarToJd } from '../../src/core/time/julian';
import type { FetchedText } from '../lib/fetchCached';
import type { HorizonsReference } from '../sources/horizons';
import { parseApproxPos, type ApproxPosData, type ApproxRow } from '../sources/jplApproxPos';
import { parsePckAssignments, radiiFor, rotationModelFor } from '../sources/naifPck';
import { DESCRIPTION_PAGES, parseMetaDescription } from '../sources/nasaScience';
import { parsePlanetFactSheet, parseSunFactSheet, parseSunNumber, planetFact, sunFact, type PlanetFactSheet } from '../sources/nssdcFactSheet';
import { nasaScienceSpec, SOURCE_SPECS, toSource } from '../sources/registry';

type DescribedBody = keyof typeof DESCRIPTION_PAGES;

export interface PipelineInputs {
  approxPos: FetchedText;
  planetSheet: FetchedText;
  sunSheet: FetchedText;
  pck: FetchedText;
  descriptions: Record<DescribedBody, FetchedText>;
  horizons: HorizonsReference;
}

export interface PipelineOutput {
  regions: RegionsFile;
  sources: SourcesFile;
  bodies: BodiesFile;
}

interface PlanetSpec {
  id: Exclude<DescribedBody, 'sun'>;
  name: string;
  naifId: number;
  column: string;
  approxRow: ApproxRow;
  color: string;
  represents: PlanetApproxOrbit['represents'];
  render: Render;
}

/** Display colours are illustrative only (no official surface maps in M1). */
export const PLANET_SPECS: PlanetSpec[] = [
  { id: 'mercury', name: 'Mercury', naifId: 199, column: 'MERCURY', approxRow: 'Mercury', color: '#9a9894', represents: 'planet', render: { shader: 'rocky', atmosphere: null, lommelSeeliger: 0.85, normalStrength: 1, bandFlow: false } },
  { id: 'venus', name: 'Venus', naifId: 299, column: 'VENUS', approxRow: 'Venus', color: '#e2c48e', represents: 'planet', render: { shader: 'venus', atmosphere: 'venus', lommelSeeliger: 0, normalStrength: 0, bandFlow: false } },
  { id: 'earth', name: 'Earth', naifId: 399, column: 'EARTH', approxRow: 'EM Bary', color: '#4c7bd0', represents: 'earth-moon-barycenter', render: { shader: 'earth', atmosphere: 'earth', lommelSeeliger: 0, normalStrength: 1, bandFlow: false } },
  { id: 'mars', name: 'Mars', naifId: 499, column: 'MARS', approxRow: 'Mars', color: '#c4673d', represents: 'planet', render: { shader: 'rocky', atmosphere: 'mars', lommelSeeliger: 0.4, normalStrength: 1, bandFlow: false } },
  { id: 'jupiter', name: 'Jupiter', naifId: 599, column: 'JUPITER', approxRow: 'Jupiter', color: '#d6b48a', represents: 'planet', render: { shader: 'giant', atmosphere: null, lommelSeeliger: 0, normalStrength: 0, bandFlow: true } },
  { id: 'saturn', name: 'Saturn', naifId: 699, column: 'SATURN', approxRow: 'Saturn', color: '#e5d09c', represents: 'planet', render: { shader: 'giant', atmosphere: null, lommelSeeliger: 0, normalStrength: 0, bandFlow: true } },
  { id: 'uranus', name: 'Uranus', naifId: 799, column: 'URANUS', approxRow: 'Uranus', color: '#a3dbe2', represents: 'planet', render: { shader: 'giant', atmosphere: null, lommelSeeliger: 0, normalStrength: 0, bandFlow: true } },
  { id: 'neptune', name: 'Neptune', naifId: 899, column: 'NEPTUNE', approxRow: 'Neptune', color: '#4b70d8', represents: 'planet', render: { shader: 'giant', atmosphere: null, lommelSeeliger: 0, normalStrength: 0, bandFlow: true } },
];

export const SOLAR_SYSTEM_REGION: Region = {
  id: 'solar-system',
  name: 'Solar System',
  parentId: null,
  frame: 'heliocentric-ecliptic-j2000',
  unit: 'km',
  originInParentKm: [0, 0, 0],
  activeRangeKm: [0, 1e13],
  dataManifest: 'solar-system/bodies.json',
};

const midnight = (year: number, month: number, day: number) => calendarToJd({ year, month, day, hour: 0, minute: 0, second: 0 });
const TABLE1_RANGE: [number, number] = [midnight(1800, 1, 1), midnight(2051, 1, 1)];
const TABLE2_RANGE: [number, number] = [midnight(-2999, 1, 1), midnight(3001, 1, 1)];

const PLANET_FACT_ROWS: Array<{ key: FactKey; row: string; scale?: number; note?: string }> = [
  { key: 'massKg', row: 'Mass', scale: 1e24 },
  { key: 'equatorialDiameterKm', row: 'Diameter' },
  { key: 'densityKgM3', row: 'Density' },
  { key: 'surfaceGravityMS2', row: 'Gravity' },
  { key: 'escapeVelocityKmS', row: 'Escape Velocity' },
  { key: 'siderealRotationHours', row: 'Rotation Period', note: 'Negative values indicate retrograde rotation (NSSDCA convention).' },
  { key: 'lengthOfDayHours', row: 'Length of Day' },
  { key: 'meanDistanceFromSunKm', row: 'Distance from Sun', scale: 1e6 },
  { key: 'perihelionKm', row: 'Perihelion', scale: 1e6 },
  { key: 'aphelionKm', row: 'Aphelion', scale: 1e6 },
  { key: 'orbitalPeriodDays', row: 'Orbital Period' },
  { key: 'meanOrbitalVelocityKmS', row: 'Orbital Velocity' },
  { key: 'orbitalInclinationDeg', row: 'Orbital Inclination' },
  { key: 'orbitalEccentricity', row: 'Orbital Eccentricity' },
  { key: 'obliquityDeg', row: 'Obliquity to Orbit' },
  { key: 'meanTemperatureC', row: 'Mean Temperature' },
  { key: 'surfacePressureBar', row: 'Surface Pressure' },
  { key: 'moonCount', row: 'Number of Moons' },
  { key: 'hasRingSystem', row: 'Ring System?' },
  { key: 'hasGlobalMagneticField', row: 'Global Magnetic Field?' },
];

function planetFacts(sheet: PlanetFactSheet, spec: PlanetSpec, approx: ApproxPosData): Body['facts'] {
  const facts: Body['facts'] = {};
  for (const { key, row, scale, note } of PLANET_FACT_ROWS) {
    const cell = planetFact(sheet, row, spec.column);
    if (cell === undefined) continue; // "Unknown" in the source: omit rather than invent
    const value = typeof cell === 'number' && scale ? cell * scale : cell;
    facts[key] = { value, sourceId: SOURCE_SPECS.nssdcaPlanets.id, ...(note ? { note } : {}) };
  }
  facts.semiMajorAxisAu = {
    value: approx.table1[spec.approxRow].elements.a,
    note: 'J2000 value from JPL Table 1 (1800–2050) elements.',
    sourceId: SOURCE_SPECS.jplApproxPos.id,
  };
  return facts;
}

function sunFacts(sheet: Map<string, string>): Body['facts'] {
  const id = SOURCE_SPECS.nssdcaSun.id;
  const num = (label: string, scale = 1, note?: string): SourcedValue => ({
    value: parseSunNumber(sunFact(sheet, label)) * scale,
    sourceId: id,
    ...(note ? { note } : {}),
  });
  return {
    massKg: num('Mass (', 1e24),
    meanRadiusKm: num('Volumetric mean radius'),
    densityKgM3: num('Mean density'),
    surfaceGravityMS2: num('Surface gravity', 1, 'At the equator.'),
    escapeVelocityKmS: num('Escape velocity'),
    absoluteMagnitude: num('Absolute magnitude'),
    luminosityW: num('Luminosity', 1e24),
    spectralType: { value: sunFact(sheet, 'Spectral type'), sourceId: id },
    siderealRotationHours: num('Sidereal rotation period', 1, "Adopted period at 16° latitude; the Sun's rotation rate varies with latitude."),
    obliquityDeg: num('Obliquity to ecliptic', 1, "Tilt of the Sun's equator relative to the ecliptic."),
  };
}

function approxOrbit(approx: ApproxPosData, spec: PlanetSpec): PlanetApproxOrbit {
  const row = spec.approxRow;
  const extra = approx.table2b[row];
  const table1: ApproxTable = {
    id: '1800-2050',
    validFromJdTdb: TABLE1_RANGE[0],
    validToJdTdb: TABLE1_RANGE[1],
    elements: approx.table1[row].elements,
    ratesPerCentury: approx.table1[row].rates,
    nominalError: approx.nominalErrors[row].table1,
  };
  const table2: ApproxTable = {
    id: '3000BC-3000AD',
    validFromJdTdb: TABLE2_RANGE[0],
    validToJdTdb: TABLE2_RANGE[1],
    elements: approx.table2a[row].elements,
    ratesPerCentury: approx.table2a[row].rates,
    nominalError: approx.nominalErrors[row].table2,
    ...(extra ? { extraTerms: extra } : {}),
  };
  return { type: 'planet-approx', sourceId: SOURCE_SPECS.jplApproxPos.id, represents: spec.represents, tables: [table1, table2] };
}

/** Attach the maximum error against the committed Horizons reference to each table. */
function withHorizonsCheck(orbit: PlanetApproxOrbit, bodyId: string, horizons: HorizonsReference): PlanetApproxOrbit {
  const samples = horizons.samples.filter((s) => s.body === bodyId);
  const tables = orbit.tables.map((table, index) => {
    let count = 0;
    let maxAngle = 0;
    let maxDistance = 0;
    for (const sample of samples) {
      const selected = selectTable(orbit.tables, sample.jdTdb);
      if (selected.index !== index || !selected.inValidRange) continue;
      const p = planetApproxState(orbit, sample.jdTdb).positionKm;
      const ref = sample.positionKm as unknown as Vec3;
      count += 1;
      maxAngle = Math.max(maxAngle, angleBetween(p, ref) / ARCSEC);
      maxDistance = Math.max(maxDistance, Math.abs(length(p) - length(ref)));
    }
    if (count === 0) return table;
    return {
      ...table,
      horizonsCheck: {
        sampleCount: count,
        maxAngularErrorArcsec: Math.round(maxAngle * 10) / 10,
        maxDistanceErrorKm: Math.round(maxDistance),
        sourceId: SOURCE_SPECS.jplHorizons.id,
      },
    };
  });
  return { ...orbit, tables };
}

export function buildSolarSystem(inputs: PipelineInputs, generatedAt: string): PipelineOutput {
  const approx = parseApproxPos(inputs.approxPos.text);
  const planetSheet = parsePlanetFactSheet(inputs.planetSheet.text);
  const sunSheet = parseSunFactSheet(inputs.sunSheet.text);
  const pck = parsePckAssignments(inputs.pck.text);
  const pckId = SOURCE_SPECS.naifPck.id;
  const description = (id: DescribedBody) => ({ text: parseMetaDescription(inputs.descriptions[id].text), sourceId: `nasa-science-${id}` });

  const sun: Body = {
    id: 'sun',
    name: 'Sun',
    category: 'star',
    parentId: null,
    regionId: SOLAR_SYSTEM_REGION.id,
    naifId: 10,
    facts: sunFacts(sunSheet),
    orbit: { type: 'fixed', positionKm: [0, 0, 0], note: 'The Sun is the origin of the heliocentric frame used for all positions.' },
    rotation: { sourceId: pckId, ...rotationModelFor(pck, 10) },
    shape: { ...radiiFor(pck, 10), sourceId: pckId },
    description: description('sun'),
    imagery: null,
    render: { shader: 'sun', atmosphere: null, lommelSeeliger: 0, normalStrength: 0, bandFlow: false },
    display: { color: '#ffd27a', note: 'illustrative' },
  };

  const planets: Body[] = PLANET_SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    category: 'planet',
    parentId: 'sun',
    regionId: SOLAR_SYSTEM_REGION.id,
    naifId: spec.naifId,
    facts: planetFacts(planetSheet, spec, approx),
    orbit: withHorizonsCheck(approxOrbit(approx, spec), spec.id, inputs.horizons),
    rotation: { sourceId: pckId, ...rotationModelFor(pck, spec.naifId) },
    shape: { ...radiiFor(pck, spec.naifId), sourceId: pckId },
    description: description(spec.id),
    imagery: null,
    render: spec.render,
    display: { color: spec.color, note: 'illustrative' },
  }));

  const sources = [
    toSource(SOURCE_SPECS.jplApproxPos, inputs.approxPos.retrievedAt),
    toSource(SOURCE_SPECS.jplHorizons, inputs.horizons.retrievedAt),
    toSource(SOURCE_SPECS.nssdcaPlanets, inputs.planetSheet.retrievedAt),
    toSource(SOURCE_SPECS.nssdcaSun, inputs.sunSheet.retrievedAt),
    toSource(SOURCE_SPECS.naifPck, inputs.pck.retrievedAt),
    toSource(nasaScienceSpec('sun', 'The Sun', DESCRIPTION_PAGES.sun), inputs.descriptions.sun.retrievedAt),
    ...PLANET_SPECS.map((spec) =>
      toSource(nasaScienceSpec(spec.id, spec.id === 'earth' ? 'Earth Facts' : spec.name, DESCRIPTION_PAGES[spec.id]), inputs.descriptions[spec.id].retrievedAt),
    ),
  ];

  return {
    regions: { schemaVersion: 1, regions: [SOLAR_SYSTEM_REGION] },
    sources: { schemaVersion: 1, sources },
    bodies: { schemaVersion: 1, regionId: SOLAR_SYSTEM_REGION.id, generatedAt, bodies: [sun, ...planets] },
  };
}
