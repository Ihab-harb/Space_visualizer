import { describe, expect, it } from 'vitest';
import { parseStatedPosition, verifyLandmarks, type LandmarksFile } from './landmarks';
import { pageText } from './quotedReference';

describe('parseStatedPosition', () => {
  it('reads hemisphere letters, in decimal degrees', () => {
    expect(parseStatedPosition('The summit lies at 27.99° N, 86.93° E in the range')).toMatchObject({ latDeg: 27.99, lonDegE: 86.93, text: '27.99° N, 86.93° E' });
  });
  it('turns minutes into decimals and west into east longitude', () => {
    expect(parseStatedPosition('located at 36°06′ N, 112°06′ W')).toMatchObject({ latDeg: 36.1, lonDegE: 247.9 });
  });
  it('reads signed numbers after the words latitude and longitude', () => {
    expect(parseStatedPosition('at latitude -25.3 and longitude 131.0')).toMatchObject({ latDeg: -25.3, lonDegE: 131 });
    expect(parseStatedPosition('at latitude 10 and longitude -112.1')).toMatchObject({ latDeg: 10, lonDegE: 247.9 });
  });
  it('reads south and the words north, south, east and west', () => {
    expect(parseStatedPosition('at 25.3° S, 131° E')).toMatchObject({ latDeg: -25.3, lonDegE: 131 });
    expect(parseStatedPosition('12 degrees north and 30 degrees west')).toMatchObject({ latDeg: 12, lonDegE: 330 });
  });
  it('is null when a number is missing or the latitude is impossible', () => {
    expect(parseStatedPosition('about 28 degrees north')).toBeNull();
    expect(parseStatedPosition('27.99° N, 86.93°')).toBeNull();
    expect(parseStatedPosition('95° N, 10° E')).toBeNull();
  });
});

const PAGE = '<p>Olympus Mons is a very tall volcano on the planet Mars. The crater lies at 36.1° N, 112.1° W on the plain and is wide. The crater is 1.2 km wide from rim to rim here. Mons, montes MO Mountain Oceanus, oceani OC A very large dark area on the moon</p>';
const SRC = { id: 'page', title: 'Page', publisher: 'NASA', url: 'https://science.nasa.gov/page', license: 'NASA public domain' };
const Q = 'Olympus Mons is a very tall volcano on the planet Mars';
const QP = 'The crater lies at 36.1° N, 112.1° W on the plain and is wide';
const QS = 'The crater is 1.2 km wide from rim to rim here';
const QT = 'Mons, montes MO Mountain Oceanus, oceani OC A very large dark area on the moon';
const pages = new Map([['page', pageText(PAGE)]]);
const file = (over: Partial<LandmarksFile> = {}): LandmarksFile => ({
  sources: [SRC],
  types: { Mons: { meaning: 'Mountain', sourceId: 'page', quote: QT } },
  bodies: { mars: [{ name: 'Olympus Mons', sourceId: 'page', quote: Q }] },
  ...over,
});
const earth = (position: object, size?: object) => file({ bodies: { earth: [{ name: 'Meteor Crater', type: 'Crater', sourceId: 'page', quote: Q, position: position as never, size: size as never }] } });
const quoted = { kind: 'quoted', latDeg: 36.1, lonDegE: 247.9, sourceId: 'page', quote: QP };

describe('verifyLandmarks', () => {
  it('passes a landmark whose quote is on its page', () => {
    expect(verifyLandmarks(file(), pages)).toEqual([]);
    expect(verifyLandmarks(earth(quoted, { km: 1.2, sourceId: 'page', quote: QS }), pages)).toEqual([]);
  });
  it('fails a quote that is not on the page', () => {
    expect(verifyLandmarks(file({ bodies: { mars: [{ name: 'X', sourceId: 'page', quote: 'This sentence is nowhere on that page at all' }] } }), pages).join()).toContain('quote not on page of page');
  });
  it('fails a quote under 6 words', () => {
    expect(verifyLandmarks(file({ bodies: { mars: [{ name: 'X', sourceId: 'page', quote: 'Olympus Mons is' }] } }), pages).join()).toContain('quote too short (3 words)');
  });
  it('fails a source on a non-official host', () => {
    expect(verifyLandmarks(file({ sources: [{ ...SRC, url: 'https://example.com/page' }] }), pages).join()).toContain('is not on an official host: example.com');
  });
  it('fails a quote that cites an unregistered source', () => {
    expect(verifyLandmarks(file({ bodies: { mars: [{ name: 'X', sourceId: 'nope', quote: Q }] } }), pages).join()).toContain('source nope is not registered');
  });
  it('fails a paper source', () => {
    const paper = { ...SRC, kind: 'paper' as const, doi: '10.1038/x', journal: 'Nature', publisher: 'Nature', url: 'https://doi.org/10.1038/x' };
    expect(verifyLandmarks(file({ sources: [paper] }), pages).join()).toContain('papers are not allowed for landmarks');
  });
  it('fails an Earth landmark whose quoted position numbers are not in its quote', () => {
    expect(verifyLandmarks(earth({ ...quoted, latDeg: 40 }), pages).join()).toContain('is not the position stated in quote');
    const noNumbers = 'The crater lies on the plain and is wide here';
    const p = new Map([['page', pageText(`${PAGE} ${noNumbers}`)]]);
    expect(verifyLandmarks(earth({ ...quoted, quote: noNumbers }), p).join()).toContain('no latitude and longitude stated');
  });
  it('fails an Earth size whose km is not in its quote', () => {
    expect(verifyLandmarks(earth(quoted, { km: 12, sourceId: 'page', quote: QS }), pages).join()).toContain('12 km not in quote');
  });
  it('fails a duplicate landmark name within a body', () => {
    const l = { name: 'Olympus Mons', sourceId: 'page', quote: Q };
    expect(verifyLandmarks(file({ bodies: { mars: [l, l] } }), pages).join()).toContain('mars/Olympus Mons: duplicate landmark name');
  });
  it('fails a type meaning whose quote lacks the type or the meaning', () => {
    const t = (type: string, meaning: string, quote: string) => file({ types: { [type]: { meaning, sourceId: 'page', quote } } });
    expect(verifyLandmarks(t('Mons', 'Mountain', 'Oceanus, oceani OC A very large dark area on the moon'), pages).join()).toContain('the type is not in its quote');
    expect(verifyLandmarks(t('Mons', 'Volcano', QT), pages).join()).toContain('the meaning "Volcano" is not in its quote');
  });
});
