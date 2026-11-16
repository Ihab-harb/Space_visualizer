import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  NAMES_SOURCES, findNamesRecord, namesFileUrl, namesSource, namesSourceSpec, parseCsv, parseNamesRecord,
} from './namesDatabase';

// Real GNIS rows (the file's header line and one record), cut from the fetched staged files.
const fixture = (name: string) => readFileSync(`pipeline/fixtures/${name}`, 'utf8');
const grandCanyon = fixture('names-gnis-AZ-23907.txt');
const erebus = fixture('names-gnis-Antarctica-2817474.txt');
const dryValleys = fixture('names-gnis-Antarctica-2821383.txt');
const dryValleysNames = fixture('names-gnis-Antarctica-2821383-allnames.txt');
// Real responses of the other sources, saved as fetched (the LINZ file is its header and three whole rows).
const etna = fixture('names-noaa-volcano-10106.json');
const challenger = fixture('names-gebco-563.json');
const hudsonBay = fixture('names-nrcan-OAHKV.csv');
const flemishCap = fixture('names-nrcan-MABQB.csv');
const conciseCodes = fixture('names-nrcan-concise.json');
const linz = fixture('names-linz-gaz.csv');

describe('parseNamesRecord', () => {
  it('reads a GNIS domestic record: name, primary point, west longitude as east', () => {
    // Record 23907: prim_lat_dec 36.112764, prim_long_dec -113.9960696.
    expect(parseNamesRecord('gnis', grandCanyon)).toEqual({
      id: '23907', name: 'Grand Canyon', variants: [], featureClass: 'Valley', latDeg: 36.112764, lonDegE: 246.0039304, text: '36.112764, -113.9960696',
    });
  });
  it('reads a GNIS Antarctica record (a different column layout)', () => {
    // Record 2817474: prim_lat_dec -77.529622, prim_long_dec 167.153231.
    expect(parseNamesRecord('gnis', erebus)).toMatchObject({ id: '2817474', name: 'Mount Erebus', featureClass: 'Summit', latDeg: -77.529622, lonDegE: 167.153231, text: '-77.529622, 167.153231' });
  });
  it('is null for anything that is not a record', () => {
    expect(parseNamesRecord('gnis', '<html>not a record</html>')).toBeNull();
    expect(parseNamesRecord('gnis', grandCanyon.split('\n')[0]!)).toBeNull(); // the header alone
  });
  it('is null when GNIS marks the location unknown (0, 0)', () => {
    const [header, row] = grandCanyon.split('\n');
    const unknown = row!.replace('360646N|1135946W|36.112764|-113.9960696', 'Unknown|Unknown|0|0');
    expect(parseNamesRecord('gnis', `${header}\n${unknown}`)).toBeNull();
  });
});

describe('findNamesRecord', () => {
  it('finds a record by its feature id in a whole file and lists the other names the database gives it', () => {
    const file = `${dryValleys}${erebus.split('\n').slice(1).join('\n')}`;
    const r = findNamesRecord('gnis', file, '2821383', dryValleysNames);
    expect(r).toMatchObject({ id: '2821383', name: 'McMurdo Dry Valleys', latDeg: -77.5, lonDegE: 162 });
    expect(r!.variants).toContain('Dry Valleys');
    expect(r!.variants).not.toContain('McMurdo Dry Valleys');
    expect(findNamesRecord('gnis', file, '2817474')).toMatchObject({ name: 'Mount Erebus', variants: [] });
  });
  it('does not match an id that is only the start of another id', () => {
    expect(findNamesRecord('gnis', grandCanyon, '2390')).toBeNull();
  });
});

describe('NOAA NCEI volcano locations', () => {
  const noaa = NAMES_SOURCES['noaa-volcano'];
  it('reads a record: its name, its morphology as the class, and the point with the digits as written', () => {
    // Record 10106: "latitude":37.748,"longitude":14.999, "morphology":"Stratovolcano".
    expect(noaa.read([etna], '10106')).toEqual({
      id: '10106', name: 'Etna', variants: [], featureClass: 'Stratovolcano', latDeg: 37.748, lonDegE: 14.999, text: '37.748, 14.999',
    });
  });
  it('is null for another id, a morphology of "Unknown" gives no class, and a west longitude turns east', () => {
    expect(noaa.read([etna], '10107')).toBeNull();
    expect(noaa.read([etna.replace('"Stratovolcano"', '"Unknown"')], '10106')!.featureClass).toBe('');
    expect(noaa.read([etna.replace('"longitude":14.999', '"longitude":-14.999')], '10106')).toMatchObject({ lonDegE: 345.001, text: '37.748, -14.999' });
  });
  it('fetches one record by id from the HazEL service', () => {
    expect(noaa.files('10106')).toEqual([{ url: 'https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/volcanolocs/10106', cacheName: 'names-noaa-volcano-10106.json' }]);
    expect(() => noaa.files('ten')).toThrow('record id');
  });
});

describe('GEBCO Gazetteer of Undersea Feature Names', () => {
  const gebco = NAMES_SOURCES.gebco;
  it('reads a feature: specific and generic terms make the name, the generic term is the class, the single point is the position', () => {
    // featureId 563: "name":"Challenger","genericTerm":"Deep", singlePointLongitude 142.591667, singlePointLatitude 11.373333.
    expect(gebco.read([challenger], '563')).toEqual({
      id: '563', name: 'Challenger Deep', variants: ['Challenger'], featureClass: 'Deep', latDeg: 11.373333, lonDegE: 142.591667, text: '11.373333, 142.591667',
    });
  });
  it('is null for another id, a feature that is not approved, or an empty search', () => {
    expect(gebco.read([challenger], '564')).toBeNull();
    expect(gebco.read([challenger.replace('"APPROVED"', '"PENDING"')], '563')).toBeNull();
    expect(gebco.read(['{"items":[],"page":1,"totalPages":0,"totalItems":0,"itemsPerPage":50}'], '563')).toBeNull();
  });
  it('fetches one feature by its feature id', () => {
    expect(gebco.files('563')).toEqual([{ url: 'https://www.ngdc.noaa.gov/gazetteer/api/v1/feature?featureId=563', cacheName: 'names-gebco-563.json' }]);
  });
});

describe('Canadian Geographical Names Database (NRCan)', () => {
  const nrcan = NAMES_SOURCES.nrcan;
  it('reads a record: the concise code term is the class, the province code is where it is', () => {
    // Key OAHKV: name Hudson Bay, concise.code BAY ("BAY-Bay" in the code list), province.code 62, latitude 60.0, longitude -86.0.
    expect(nrcan.read([hudsonBay, conciseCodes], 'OAHKV')).toEqual({
      id: 'OAHKV', name: 'Hudson Bay', variants: [], featureClass: 'Bay', latDeg: 60, lonDegE: 274, text: '60.0, -86.0', territory: '62',
    });
  });
  it('holds only the provinces and territories: an undersea feature (province code 72) is outside Canada', () => {
    const flemish = nrcan.read([flemishCap, conciseCodes], 'MABQB')!;
    expect(flemish).toMatchObject({ name: 'Flemish Cap', featureClass: 'Undersea Feature', territory: '72' });
    expect(nrcan.country!.holds(flemish.territory!)).toBe(false);
    expect(nrcan.country!.holds('62')).toBe(true);
  });
  it('is null for another key, and fetches the record and the code list', () => {
    expect(nrcan.read([hudsonBay, conciseCodes], 'OASUG')).toBeNull();
    expect(nrcan.files('OAHKV')).toEqual([
      { url: 'https://geogratis.gc.ca/services/geoname/en/geonames/OAHKV.csv', cacheName: 'names-nrcan-OAHKV.csv' },
      { url: 'https://geogratis.gc.ca/services/geoname/en/codes/concise.json', cacheName: 'names-nrcan-concise.json' },
    ]);
    expect(() => nrcan.files('oahkv')).toThrow('record id');
  });
});

describe('New Zealand Gazetteer (LINZ)', () => {
  const nz = NAMES_SOURCES.linz;
  it('reads a record by name_id from the whole file: feat_type is the class, the land district is where it is', () => {
    // name_id 7297: Aoraki/Mount Cook, feat_type Hill, land_district Canterbury, crd_latitude -43.595348, crd_longitude 170.141926.
    expect(nz.read([linz], '7297')).toEqual({
      id: '7297', name: 'Aoraki/Mount Cook', variants: [], featureClass: 'Hill', latDeg: -43.595348, lonDegE: 170.141926, text: '-43.595348, 170.141926', territory: 'Canterbury',
    });
    expect(nz.read([linz], '6961')).toMatchObject({ name: 'Whakaari / White Island', featureClass: 'Island', territory: 'South Auckland' });
  });
  it('holds only records in a New Zealand land district: a Ross Dependency record has none', () => {
    const ross = nz.read([linz], '12865')!;
    expect(ross).toMatchObject({ name: 'Mount Erebus', territory: '' });
    expect(nz.country!.holds(ross.territory!)).toBe(false);
    expect(nz.country!.holds('Canterbury')).toBe(true);
  });
  it('is null for an id that is not in the file', () => {
    expect(nz.read([linz], '729')).toBeNull();
  });
});

describe('parseCsv', () => {
  it('keeps commas, doubled quotes and line breaks inside quoted fields', () => {
    expect(parseCsv('﻿a,b\r\n1,"x, ""y""\nz"\n')).toEqual([['a', 'b'], ['1', 'x, "y"\nz']]);
  });
});

describe('the registry', () => {
  it('fetches GNIS from the National Map staged files, by state or Antarctica', () => {
    expect(namesFileUrl('gnis', 'AZ')).toBe('https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/DomesticNames/DomesticNames_AZ_Text.zip');
    expect(namesFileUrl('gnis', 'Antarctica')).toBe('https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/Antarctica/Gazetteer_Antarctica_Text.zip');
    expect(() => namesFileUrl('gnis', 'Arizona')).toThrow('GNIS area');
    expect(NAMES_SOURCES.gnis.files('2817474', 'Antarctica')).toEqual([{
      url: 'https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/Antarctica/Gazetteer_Antarctica_Text.zip',
      cacheName: 'names-gnis-Antarctica.zip', zipEntries: ['/AntarcticaNames_Antarctica.txt', '/AntarcticaAllNames_Antarctica.txt'],
    }]);
  });
  it('cites each source to its own page, on its own host', () => {
    expect(namesSourceSpec('gnis')).toMatchObject({ id: 'usgs-gnis', url: 'https://www.usgs.gov/us-board-on-geographic-names/download-gnis-data' });
    for (const s of Object.values(NAMES_SOURCES)) {
      if (s.notInUse) continue;
      const host = new URL(s.spec!.url).hostname;
      expect(host === s.host || host.endsWith(`.${s.host}`), `${s.database}: ${host} on ${s.host}`).toBe(true);
    }
  });
  it('keeps the GEOnet Names Server defined but not in use', () => {
    expect(NAMES_SOURCES.gns.notInUse).toContain('the GEOnet Names Server is not in use');
    expect(() => namesSourceSpec('gns')).toThrow('not in use');
    expect(() => NAMES_SOURCES.gns.files('1')).toThrow('not in use');
  });
  it('knows no other database', () => {
    expect(namesSource('geonames-org')).toBeUndefined();
  });
});
