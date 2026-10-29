import type { FactKey } from '../../src/core/catalog/facts';
import type { ApproxTable, Body, BodiesFile, ChebyshevFile, HorizonsCheck, ImageryFile, SatelliteOrbit, PlanetApproxOrbit, Region, Render, RegionsFile, SourcedValue, SourcesFile } from '../../src/core/catalog/schema';
import { chebyshevRange, evaluateChebyshev } from '../../src/core/ephemeris/chebyshev';
import { meanElementsGeocentricKm } from '../../src/core/ephemeris/meanElements';
import { planetApproxState, selectTable } from '../../src/core/ephemeris/planetApprox';
import { systemState } from '../../src/core/ephemeris/system';
import { ARCSEC } from '../../src/core/math/angles';
import { angleBetween, length, sub as vsub, type Vec3 } from '../../src/core/math/vec3';
import { calendarToJd } from '../../src/core/time/julian';
import type { FetchedText } from '../lib/fetchCached';
import type { HorizonsMoonCheck, HorizonsReference } from '../sources/horizons';
import { parseApproxPos, type ApproxPosData, type ApproxRow } from '../sources/jplApproxPos';
import { parseMoonMeanElements } from '../sources/jplSatElem';
import { parseGmKernel } from '../sources/naifGm';
import { parsePckAssignments, radiiFor, rotationModelFor } from '../sources/naifPck';
import { DESCRIPTION_PAGES, parseMetaDescription } from '../sources/nasaScience';
import { parsePlanetFactSheet, parseSunFactSheet, parseSunNumber, planetFact, sunFact, type PlanetFactSheet } from '../sources/nssdcFactSheet';
import { parseMoonFactSheet } from '../sources/nssdcMoonSheet';
import { nasaScienceSpec, planetSheetSpec, SOURCE_SPECS, toSource } from '../sources/registry';

type DescribedBody = keyof typeof DESCRIPTION_PAGES;

export interface PipelineInputs {
  approxPos: FetchedText;
  planetSheet: FetchedText;
  sunSheet: FetchedText;
  pck: FetchedText;
  gmKernel: FetchedText;
  moonSheet: FetchedText;
  satElemPage: FetchedText;
  /** public/data/solar-system/ephemeris/moon.json */
  moonTable: ChebyshevFile;
  moonCheck: HorizonsMoonCheck;
  descriptions: Record<DescribedBody, FetchedText>;
  horizons: HorizonsReference;
  imagery: ImageryFile;
}

export interface PipelineOutput {
  regions: RegionsFile;
  sources: SourcesFile;
  bodies: BodiesFile;
}

interface PlanetSpec {
  id: Exclude<DescribedBody, 'sun' | 'moon'>;
  name: string;
  naifId: number;
  column: string;
  approxRow: ApproxRow;
  color: string;
  represents: PlanetApproxOrbit['represents'];
  render: Render;
}

/** Fallback display colours, illustrative only; official imagery (imagery.json) replaces them where a body has a map. */
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

const MOON_SHEET_ROWS: Array<{ key: FactKey; row: string; scale?: number; note?: string }> = [
  { key: 'massKg', row: 'Mass', scale: 1e24 },
  { key: 'meanRadiusKm', row: 'Volumetric mean radius' },
  { key: 'densityKgM3', row: 'Mean density' },
  { key: 'surfaceGravityMS2', row: 'Surface gravity' },
  { key: 'escapeVelocityKmS', row: 'Escape velocity' },
  { key: 'meanDistanceFromParentKm', row: 'Semimajor axis', scale: 1e6 },
  { key: 'periapsisKm', row: 'Perigee', scale: 1e6, note: 'Mean perigee (NSSDCA).' },
  { key: 'apoapsisKm', row: 'Apogee', scale: 1e6, note: 'Mean apogee (NSSDCA).' },
  { key: 'orbitalPeriodDays', row: 'Revolution period', note: 'About Earth.' },
  { key: 'synodicPeriodDays', row: 'Synodic period' },
  { key: 'meanOrbitalVelocityKmS', row: 'Mean orbital velocity', note: 'About Earth.' },
  { key: 'orbitalInclinationDeg', row: 'Inclination to ecliptic', note: 'About Earth.' },
  { key: 'orbitalEccentricity', row: 'Orbit eccentricity', note: 'About Earth.' },
  { key: 'siderealRotationHours', row: 'Sidereal rotation period' },
  { key: 'obliquityDeg', row: 'Obliquity to orbit' },
];

/** From the Planetary Fact Sheet MOON column. Its orbit cells are starred (about Earth), so none are read. */
const MOON_PLANETARY_ROWS: Array<{ key: FactKey; row: string }> = [
  { key: 'equatorialDiameterKm', row: 'Diameter' },
  { key: 'lengthOfDayHours', row: 'Length of Day' },
  { key: 'meanTemperatureC', row: 'Mean Temperature' },
  { key: 'surfacePressureBar', row: 'Surface Pressure' },
  { key: 'moonCount', row: 'Number of Moons' },
  { key: 'hasRingSystem', row: 'Ring System?' },
  { key: 'hasGlobalMagneticField', row: 'Global Magnetic Field?' },
];

function moonFacts(planetSheet: PlanetFactSheet, moonSheet: Map<string, number>): Body['facts'] {
  const facts: Body['facts'] = {};
  const sheetId = planetSheetSpec('moon', 'Moon').id;
  for (const { key, row, scale, note } of MOON_SHEET_ROWS) {
    const v = moonSheet.get(row);
    if (v === undefined) throw new Error(`Moon fact sheet row "${row}" not found`);
    // toPrecision removes float noise from the unit scaling (0.3844 * 1e6 -> 384400).
    facts[key] = { value: scale ? Number((v * scale).toPrecision(12)) : v, sourceId: sheetId, ...(note ? { note } : {}) };
  }
  for (const { key, row } of MOON_PLANETARY_ROWS) {
    const cell = planetFact(planetSheet, row, 'MOON');
    if (cell !== undefined) facts[key] = { value: cell, sourceId: SOURCE_SPECS.nssdcaPlanets.id };
  }
  return facts;
}

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

const GM_EARTH_ID = 399;
const GM_MOON_ID = 301;
const HELD_OUT_KM_TOLERANCE = 1e-6;
const HELD_OUT_ARCSEC_TOLERANCE = 1e-4;

/** Fail unless the committed table reproduces its held-out summary on the committed held-out subset. */
function checkHeldOutAgainstTable(table: ChebyshevFile, check: HorizonsMoonCheck): void {
  let maxKm = 0;
  let maxArcsec = 0;
  let used = 0;
  for (const sample of check.heldOut) {
    // The Horizons fetch ran a few days past the table's last segment; those samples say nothing about the table.
    const p = evaluateChebyshev(table, sample.jdTdb);
    if (!p) continue;
    used += 1;
    maxKm = Math.max(maxKm, length(vsub(p, sample.positionKm)));
    maxArcsec = Math.max(maxArcsec, angleBetween(p, sample.positionKm) / ARCSEC);
  }
  if (used < check.heldOut.length * 0.99) throw new Error(`Moon held-out check: only ${used} of ${check.heldOut.length} samples fall inside the committed table`);
  const { maxDistanceErrorKm, maxAngularErrorArcsec } = check.heldOutSummary;
  if (maxKm > maxDistanceErrorKm + HELD_OUT_KM_TOLERANCE || maxArcsec > maxAngularErrorArcsec + HELD_OUT_ARCSEC_TOLERANCE) {
    throw new Error(
      `Moon table does not match its held-out summary: recomputed max ${maxKm} km / ${maxArcsec} arcsec on the held-out subset, summary says ${maxDistanceErrorKm} km / ${maxAngularErrorArcsec} arcsec`,
    );
  }
}

/** Mean-elements error against the Horizons Moon positions that fall outside the table (1800-2050) but inside the elements' range. */
function meanElementsCheck(m: SatelliteOrbit['meanElements'], check: HorizonsMoonCheck): HorizonsCheck | undefined {
  let count = 0;
  let maxAngle = 0;
  let maxDistance = 0;
  for (const ref of check.referenceDates) {
    if (ref.jdTdb >= TABLE1_RANGE[0] && ref.jdTdb < TABLE1_RANGE[1]) continue;
    if (ref.jdTdb < m.validFromJdTdb || ref.jdTdb > m.validToJdTdb) continue;
    const p = meanElementsGeocentricKm(m, ref.jdTdb);
    count += 1;
    maxAngle = Math.max(maxAngle, angleBetween(p, ref.positionKm) / ARCSEC);
    maxDistance = Math.max(maxDistance, length(vsub(p, ref.positionKm)));
  }
  if (count === 0) return undefined;
  return { sampleCount: count, maxAngularErrorArcsec: Math.round(maxAngle * 10) / 10, maxDistanceErrorKm: Math.round(maxDistance), sourceId: SOURCE_SPECS.jplHorizons.id };
}

function moonOrbit(inputs: PipelineInputs, gm: Map<number, number>): SatelliteOrbit {
  const gmEarth = gm.get(GM_EARTH_ID);
  const gmMoon = gm.get(GM_MOON_ID);
  if (gmEarth === undefined || gmMoon === undefined) throw new Error('GM kernel: BODY399_GM or BODY301_GM missing');
  checkHeldOutAgainstTable(inputs.moonTable, inputs.moonCheck);
  const row = parseMoonMeanElements(inputs.satElemPage.text);
  if (row.epoch !== '2000-01-01.5') throw new Error(`JPL satellite elements: expected epoch 2000-01-01.5, got ${row.epoch}`);
  if (!row.hasEphemerisWarning) throw new Error('JPL satellite elements: the "not intended for ephemeris computation" warning is no longer on the page');
  const range = chebyshevRange(inputs.moonTable);
  const meanElements: SatelliteOrbit['meanElements'] = {
    sourceId: SOURCE_SPECS.jplSatElem.id,
    epochJdTdb: 2451545.0, // 2000-01-01.5 TDB
    aKm: row.aKm,
    e: row.e,
    argPeriDeg: row.argPeriDeg,
    meanAnomalyDeg: row.meanAnomalyDeg,
    iDeg: row.iDeg,
    nodeDeg: row.nodeDeg,
    siderealPeriodDays: row.siderealPeriodDays,
    apsisPeriodYears: row.apsisPeriodYears,
    nodePeriodYears: row.nodePeriodYears,
    validFromJdTdb: TABLE2_RANGE[0],
    validToJdTdb: TABLE2_RANGE[1],
    note: 'JPL warns these mean elements are "not intended for ephemeris computation"; they are used only outside 1800–2050.',
  };
  const horizonsCheck = meanElementsCheck(meanElements, inputs.moonCheck);
  return {
    type: 'satellite',
    table: {
      file: 'solar-system/ephemeris/moon.json',
      sourceId: inputs.moonTable.sourceId,
      validFromJdTdb: range.fromJdTdb,
      validToJdTdb: range.toJdTdb,
      horizonsCheck: { ...inputs.moonCheck.heldOutSummary, sourceId: SOURCE_SPECS.jplHorizons.id },
    },
    meanElements: horizonsCheck ? { ...meanElements, horizonsCheck } : meanElements,
    barycentre: {
      massRatio: {
        value: gmMoon / (gmEarth + gmMoon),
        sourceId: SOURCE_SPECS.naifGm.id,
        note: "Moon's share of the Earth–Moon mass (DE440 GM values).",
      },
    },
  };
}

/** Earth's centre (barycentre corrected by the Moon's share) against Horizons body 399, over the samples inside Table 1. */
function earthCentreCheck(bodies: readonly Body[], moonTable: ChebyshevFile, horizons: HorizonsReference): HorizonsCheck {
  const tables = new Map([['moon', moonTable]]);
  let count = 0;
  let maxAngle = 0;
  let maxDistance = 0;
  for (const sample of horizons.samples.filter((s) => s.body === 'earth-centre')) {
    if (sample.jdTdb < TABLE1_RANGE[0] || sample.jdTdb >= TABLE1_RANGE[1]) continue;
    const p = systemState(bodies, tables, sample.jdTdb).get('earth')!.positionKm;
    const ref = sample.positionKm as unknown as Vec3;
    count += 1;
    maxAngle = Math.max(maxAngle, angleBetween(p, ref) / ARCSEC);
    maxDistance = Math.max(maxDistance, Math.abs(length(p) - length(ref))); // same convention as the planet tables' checks
  }
  if (count === 0) throw new Error('No Horizons Earth-centre samples inside 1800–2050');
  return { sampleCount: count, maxAngularErrorArcsec: Math.round(maxAngle * 10) / 10, maxDistanceErrorKm: Math.round(maxDistance), sourceId: SOURCE_SPECS.jplHorizons.id };
}

export function buildSolarSystem(inputs: PipelineInputs, generatedAt: string): PipelineOutput {
  const approx = parseApproxPos(inputs.approxPos.text);
  const planetSheet = parsePlanetFactSheet(inputs.planetSheet.text);
  const sunSheet = parseSunFactSheet(inputs.sunSheet.text);
  const pck = parsePckAssignments(inputs.pck.text);
  const moonSheet = parseMoonFactSheet(inputs.moonSheet.text);
  const gm = parseGmKernel(inputs.gmKernel.text);
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
    imagery: inputs.imagery.bodies.sun ?? null,
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
    imagery: inputs.imagery.bodies[spec.id] ?? null,
    render: spec.render,
    display: { color: spec.color, note: 'illustrative' },
  }));

  const moon: Body = {
    id: 'moon',
    name: 'Moon',
    category: 'moon',
    parentId: 'earth',
    regionId: SOLAR_SYSTEM_REGION.id,
    naifId: 301,
    facts: moonFacts(planetSheet, moonSheet),
    orbit: moonOrbit(inputs, gm),
    rotation: { sourceId: pckId, ...rotationModelFor(pck, 301) },
    shape: { ...radiiFor(pck, 301), sourceId: pckId },
    description: description('moon'),
    imagery: inputs.imagery.bodies.moon ?? null,
    render: { shader: 'rocky', atmosphere: null, lommelSeeliger: 0.9, normalStrength: 1, bandFlow: false },
    display: { color: '#c9c5bd', note: 'illustrative' },
  };

  // Earth is drawn at its own centre (barycentre minus the Moon's share), so its accuracy is measured on the composed system.
  const earth = planets.find((p) => p.id === 'earth')!;
  if (earth.orbit.type !== 'planet-approx') throw new Error('Earth must have a planet-approx orbit');
  earth.orbit = { ...earth.orbit, centreCheck: earthCentreCheck([sun, ...planets, moon], inputs.moonTable, inputs.horizons) };

  const sources = [
    toSource(SOURCE_SPECS.naifGm, inputs.gmKernel.retrievedAt),
    toSource(SOURCE_SPECS.jplSatElem, inputs.satElemPage.retrievedAt),
    toSource(planetSheetSpec('moon', 'Moon'), inputs.moonSheet.retrievedAt),
    toSource(nasaScienceSpec('moon', 'The Moon', DESCRIPTION_PAGES.moon), inputs.descriptions.moon.retrievedAt),

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

  for (const s of inputs.imagery.sources) if (!sources.some((x) => x.id === s.id)) sources.push(s);

  return {
    regions: { schemaVersion: 1, regions: [SOLAR_SYSTEM_REGION] },
    sources: { schemaVersion: 1, sources },
    bodies: { schemaVersion: 1, regionId: SOLAR_SYSTEM_REGION.id, generatedAt, bodies: [sun, ...planets, moon] },
  };
}
