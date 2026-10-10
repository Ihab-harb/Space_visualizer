import type { BodyDetails } from '../core/details/schema';

const PS = 'nssdca-planetary-fact-sheet';
const SUN = 'nssdca-sun-fact-sheet';
const GENERATED_AT = '2026-10-10T00:00:00.000Z';

export function makeMarsDetails(): BodyDetails {
  return {
    schemaVersion: 1,
    bodyId: 'mars',
    generatedAt: GENERATED_AT,
    interior: {
      layers: [
        {
          id: 'crust', name: 'Crust',
          outerRadiusKm: { min: 3389.5, max: 3389.5, sourceId: PS },
          innerRadiusKm: { min: 3339.5, max: 3339.5, sourceId: PS },
          from: 'radius', state: 'solid', composition: null, uncertain: false,
        },
        {
          id: 'core', name: 'Core',
          outerRadiusKm: { min: 1830, max: 1830, sourceId: PS },
          innerRadiusKm: { min: 0, max: 0, sourceId: PS },
          from: 'radius', state: 'liquid', composition: null, uncertain: true,
        },
      ],
    },
    atmosphere: {
      basis: 'By volume, near the surface',
      major: [{ name: 'Carbon dioxide', formula: 'CO2', amount: 95.1, unit: '%', uncertainty: null, sourceId: PS }],
      minor: [{ name: 'Water', formula: 'H2O', amount: 210, unit: 'ppm', uncertainty: null, sourceId: PS }],
      note: null,
    },
    magnetosphere: { kind: 'none', sourceId: PS },
    missions: [
      { id: 'mariner-4', name: 'Mariner 4', agency: 'NASA', type: 'flyby', launchDate: '1964-11-28', arrivalDate: '1965-07-14', endDate: '1967-12-21', outcome: 'success', sourceId: PS },
    ],
    discovery: { kind: 'antiquity', sourceId: PS },
    features: {
      totalApproved: { value: 1, sourceId: PS },
      thresholdKm: 100,
      sourceId: PS,
      items: [
        { name: 'Olympus Mons', type: 'Mons, montes', latDeg: 18.65, lonDegE: 226.2, diameterKm: 624, origin: 'Classical albedo feature name', approvedYear: 1973 },
      ],
    },
  };
}

export function makeJupiterDetails(): BodyDetails {
  const S = 'nasa-science-jupiter';
  return {
    schemaVersion: 1,
    bodyId: 'jupiter',
    generatedAt: GENERATED_AT,
    interior: null,
    atmosphere: {
      basis: 'By volume, at the 1 bar level',
      major: [
        { name: 'Hydrogen', formula: 'H2', amount: 89.8, unit: '%', uncertainty: 2.0, sourceId: PS },
        { name: 'Helium', formula: 'He', amount: 10.2, unit: '%', uncertainty: 2.0, sourceId: PS },
      ],
      minor: [],
      note: null,
    },
    magnetosphere: {
      kind: 'dipole',
      strengthGaussR3: { value: 4.30, sourceId: PS },
      tiltDeg: { value: 9.4, sourceId: PS },
      tiltLongitudeDeg: { value: 200.1, sourceId: PS },
      dipolePole: null,
      offsetRadii: { value: 0.119, sourceId: PS },
      referenceRadiusKm: { value: 71398, sourceId: PS },
      surfaceFieldGauss: { min: 4.0, max: 13.0, sourceId: PS },
    },
    missions: [
      { id: 'juno', name: 'Juno', agency: 'NASA', type: 'orbiter', launchDate: '2011-08-05', arrivalDate: '2016-07-05', endDate: null, outcome: 'ongoing', sourceId: S },
    ],
    discovery: { kind: 'antiquity', sourceId: S },
    features: null,
  };
}

export function makeSunDetails(): BodyDetails {
  return {
    schemaVersion: 1,
    bodyId: 'sun',
    generatedAt: GENERATED_AT,
    interior: {
      layers: [
        {
          id: 'radiative-zone', name: 'Radiative zone',
          outerRadiusKm: { min: 486990, max: 486990, sourceId: SUN },
          innerRadiusKm: { min: 173925, max: 173925, sourceId: SUN },
          from: 'percent', state: 'plasma', composition: null, uncertain: false,
        },
        {
          id: 'core', name: 'Core',
          outerRadiusKm: { min: 173925, max: 173925, sourceId: SUN },
          innerRadiusKm: { min: 0, max: 0, sourceId: SUN },
          from: 'percent', state: 'plasma', composition: null, uncertain: false,
        },
      ],
    },
    atmosphere: {
      basis: 'Photosphere, by number of atoms',
      major: [
        { name: 'Hydrogen', formula: 'H', amount: 90.965, unit: '%', uncertainty: null, sourceId: SUN },
        { name: 'Helium', formula: 'He', amount: 8.889, unit: '%', uncertainty: null, sourceId: SUN },
      ],
      minor: [],
      note: null,
    },
    magnetosphere: {
      kind: 'other',
      note: { text: 'The Sun has a complex, time-varying magnetic field that reverses polarity roughly every 11 years.', sourceId: 'nasa-science-sun' },
    },
    missions: [],
    discovery: null,
    features: null,
  };
}
