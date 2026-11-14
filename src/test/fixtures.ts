import type { Body, BodiesFile, RegionsFile, Source, SourcesFile } from '../core/catalog/schema';
import { APPROX_ORBITS } from './approxOrbits';

// Real values from the NSSDCA fact sheets, NAIF PCK00011 and NASA Science.
// Jupiter's tiny periodic rotation terms are omitted to keep the fixture short.

export const TEST_SOURCES: Source[] = [
  { id: 'jpl-approx-pos', title: 'Approximate Positions of the Planets', publisher: 'NASA/JPL Solar System Dynamics', url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html', retrievedAt: '2026-10-04', license: 'NASA/JPL public web content (JPL Image Use Policy)' },
  { id: 'jpl-horizons', title: 'Horizons System reference vectors', publisher: 'NASA/JPL Solar System Dynamics', url: 'https://ssd.jpl.nasa.gov/horizons/', retrievedAt: '2026-10-04', license: 'NASA/JPL public web content (JPL Image Use Policy)' },
  { id: 'nssdca-planetary-fact-sheet', title: 'Planetary Fact Sheet - Metric', publisher: 'NASA Goddard Space Flight Center, NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/', retrievedAt: '2026-10-04', license: 'NASA public domain' },
  { id: 'nssdca-sun-fact-sheet', title: 'Sun Fact Sheet', publisher: 'NASA Goddard Space Flight Center, NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html', retrievedAt: '2026-10-04', license: 'NASA public domain' },
  { id: 'naif-pck00011', title: 'PCK00011 planetary constants kernel (IAU WGCCRE 2015 report values)', publisher: 'NASA/JPL Navigation and Ancillary Information Facility (NAIF)', url: 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc', retrievedAt: '2026-10-04', license: 'NASA public domain' },
  { id: 'nasa-science-sun', title: 'The Sun - NASA Science', publisher: 'NASA', url: 'https://science.nasa.gov/sun/', retrievedAt: '2026-10-04', license: 'NASA public domain (NASA media usage guidelines)' },
  { id: 'nasa-science-earth', title: 'Earth Facts - NASA Science', publisher: 'NASA', url: 'https://science.nasa.gov/earth/facts/', retrievedAt: '2026-10-04', license: 'NASA public domain (NASA media usage guidelines)' },
  { id: 'nasa-science-jupiter', title: 'Jupiter - NASA Science', publisher: 'NASA', url: 'https://science.nasa.gov/jupiter/', retrievedAt: '2026-10-04', license: 'NASA public domain (NASA media usage guidelines)' },
  { id: 'nasa-svs-deep-star-maps', title: 'Deep Star Maps 2020', publisher: 'NASA Goddard Scientific Visualization Studio', url: 'https://svs.gsfc.nasa.gov/4851', retrievedAt: '2026-10-04', license: 'NASA public domain (credit NASA/Goddard SVS; Gaia DR2: ESA/Gaia/DPAC)' },
];

const PS = 'nssdca-planetary-fact-sheet';

export function makeSun(): Body {
  return {
    id: 'sun', name: 'Sun', category: 'star', parentId: null, regionId: 'solar-system', naifId: 10,
    facts: {
      massKg: { value: 1.9884e30, sourceId: 'nssdca-sun-fact-sheet' },
      meanRadiusKm: { value: 695700, sourceId: 'nssdca-sun-fact-sheet' },
      densityKgM3: { value: 1408, sourceId: 'nssdca-sun-fact-sheet' },
      surfaceGravityMS2: { value: 274, sourceId: 'nssdca-sun-fact-sheet' },
      siderealRotationHours: { value: 609.12, note: 'Adopted period at 16° latitude; the Sun rotates faster at its equator than near its poles.', sourceId: 'nssdca-sun-fact-sheet' },
      spectralType: { value: 'G2 V', sourceId: 'nssdca-sun-fact-sheet' },
    },
    orbit: { type: 'fixed', positionKm: [0, 0, 0], note: 'The Sun is the origin of the heliocentric frame used for all positions.' },
    rotation: { sourceId: 'naif-pck00011', poleRa: [286.13, 0, 0], poleDec: [63.87, 0, 0], pm: [84.176, 14.1844, 0], nutPrecRa: [], nutPrecDec: [], nutPrecPm: [], nutPrecAngles: [] },
    shape: { equatorialRadiusKm: 695700, polarRadiusKm: 695700, sourceId: 'naif-pck00011' },
    description: { text: 'The Sun is the star at the heart of our solar system. Its gravity holds the solar system together, keeping everything – from the biggest planets to the smallest bits of debris – in its orbit.', sourceId: 'nasa-science-sun' },
    imagery: null,
    render: { shader: 'sun', atmosphere: null, lommelSeeliger: 0, normalStrength: 0, bandFlow: false },
    display: { color: '#ffd27a', note: 'illustrative' },
  };
}

export function makeEarth(): Body {
  return {
    id: 'earth', name: 'Earth', category: 'planet', parentId: 'sun', regionId: 'solar-system', naifId: 399,
    facts: {
      massKg: { value: 5.97e24, sourceId: PS },
      equatorialDiameterKm: { value: 12756, sourceId: PS },
      obliquityDeg: { value: 23.4, sourceId: PS },
      surfacePressureBar: { value: 1, sourceId: PS },
      semiMajorAxisAu: { value: 1.00000261, sourceId: 'jpl-approx-pos' },
    },
    orbit: structuredClone(APPROX_ORBITS.earth),
    rotation: { sourceId: 'naif-pck00011', poleRa: [0, -0.641, 0], poleDec: [90, -0.557, 0], pm: [190.147, 360.9856235, 0], nutPrecRa: [], nutPrecDec: [], nutPrecPm: [], nutPrecAngles: [] },
    shape: { equatorialRadiusKm: 6378.1366, polarRadiusKm: 6356.7519, sourceId: 'naif-pck00011' },
    description: { text: "Earth is the third planet from the Sun, and the fifth largest planet. It's the only place we know of inhabited by living things.", sourceId: 'nasa-science-earth' },
    imagery: null,
    render: { shader: 'earth', atmosphere: 'earth', lommelSeeliger: 0, normalStrength: 1, bandFlow: false },
    display: { color: '#4c7bd0', note: 'illustrative' },
  };
}

export function makeJupiter(): Body {
  const orbit = structuredClone(APPROX_ORBITS.jupiter);
  // Test-only values (shape matches what the pipeline emits; not shown to users).
  orbit.tables[0]!.horizonsCheck = { sampleCount: 6, maxAngularErrorArcsec: 310, maxDistanceErrorKm: 552000, sourceId: 'jpl-horizons' };
  return {
    id: 'jupiter', name: 'Jupiter', category: 'planet', parentId: 'sun', regionId: 'solar-system', naifId: 599,
    facts: {
      massKg: { value: 1.898e27, sourceId: PS },
      equatorialDiameterKm: { value: 142984, sourceId: PS },
      densityKgM3: { value: 1326, sourceId: PS },
      surfaceGravityMS2: { value: 23.1, sourceId: PS },
      escapeVelocityKmS: { value: 59.5, sourceId: PS },
      siderealRotationHours: { value: 9.9, sourceId: PS },
      obliquityDeg: { value: 3.1, sourceId: PS },
      meanTemperatureC: { value: -110, sourceId: PS },
      moonCount: { value: 95, sourceId: PS },
      hasRingSystem: { value: true, sourceId: PS },
      semiMajorAxisAu: { value: 5.202887, sourceId: 'jpl-approx-pos' },
      orbitalPeriodDays: { value: 4331, sourceId: PS },
      orbitalEccentricity: { value: 0.049, sourceId: PS },
    },
    orbit,
    rotation: { sourceId: 'naif-pck00011', poleRa: [268.056595, -0.006499, 0], poleDec: [64.495303, 0.002413, 0], pm: [284.95, 870.536, 0], nutPrecRa: [], nutPrecDec: [], nutPrecPm: [], nutPrecAngles: [] },
    shape: { equatorialRadiusKm: 71492, polarRadiusKm: 66854, sourceId: 'naif-pck00011' },
    description: { text: 'Jupiter is the fifth planet from the Sun, and the largest in the solar system – more than twice as massive as the other planets combined.', sourceId: 'nasa-science-jupiter' },
    imagery: null,
    render: { shader: 'giant', atmosphere: null, lommelSeeliger: 0, normalStrength: 0, bandFlow: true },
    display: { color: '#d6b48a', note: 'illustrative' },
  };
}

export function makeCatalogFiles(): { regions: RegionsFile; sources: SourcesFile; bodies: BodiesFile } {
  return {
    regions: {
      schemaVersion: 1,
      regions: [{ id: 'solar-system', name: 'Solar System', parentId: null, frame: 'heliocentric-ecliptic-j2000', unit: 'km', originInParentKm: [0, 0, 0], activeRangeKm: [0, 1e13], dataManifest: 'solar-system/bodies.json' }],
    },
    sources: { schemaVersion: 1, sources: structuredClone(TEST_SOURCES) },
    bodies: { schemaVersion: 1, regionId: 'solar-system', generatedAt: '2026-10-04T12:00:00.000Z', bodies: [makeSun(), makeEarth(), makeJupiter()] },
  };
}
