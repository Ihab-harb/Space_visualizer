import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findNamesRecord, namesFileUrl, namesSourceSpec, parseNamesRecord } from './namesDatabase';

// Real GNIS rows (the file's header line and one record), cut from the fetched staged files.
const fixture = (name: string) => readFileSync(`pipeline/fixtures/${name}`, 'utf8');
const grandCanyon = fixture('names-gnis-AZ-23907.txt');
const erebus = fixture('names-gnis-Antarctica-2817474.txt');
const dryValleys = fixture('names-gnis-Antarctica-2821383.txt');
const dryValleysNames = fixture('names-gnis-Antarctica-2821383-allnames.txt');

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

describe('names files and sources', () => {
  it('fetches GNIS from the National Map staged files, by state or Antarctica', () => {
    expect(namesFileUrl('gnis', 'AZ')).toBe('https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/DomesticNames/DomesticNames_AZ_Text.zip');
    expect(namesFileUrl('gnis', 'Antarctica')).toBe('https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/Antarctica/Gazetteer_Antarctica_Text.zip');
    expect(() => namesFileUrl('gnis', 'Arizona')).toThrow('GNIS area');
  });
  it('cites GNIS to its USGS page', () => {
    expect(namesSourceSpec('gnis')).toMatchObject({ id: 'usgs-gnis', url: 'https://www.usgs.gov/us-board-on-geographic-names/download-gnis-data' });
  });
});
