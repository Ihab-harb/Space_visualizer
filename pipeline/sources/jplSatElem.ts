import { cellText, parseHtml } from '../lib/html';

export interface MoonMeanElementsRow {
  epoch: string;
  aKm: number;
  e: number;
  argPeriDeg: number;
  meanAnomalyDeg: number;
  iDeg: number;
  nodeDeg: number;
  siderealPeriodDays: number;
  apsisPeriodYears: number;
  nodePeriodYears: number;
  /** True when the page carries its warning that the elements are "not intended for ephemeris computation". */
  hasEphemerisWarning: boolean;
}

/** The Moon (NAIF 301) row of https://ssd.jpl.nasa.gov/sats/elem/ . Throws if the row or any column is missing. */
export function parseMoonMeanElements(html: string): MoonMeanElementsRow {
  const root = parseHtml(html);
  for (const tr of root.querySelectorAll('tr')) {
    const cells = tr.querySelectorAll('td').map(cellText);
    const i = cells.indexOf('Moon');
    if (i < 0 || cells[i + 1] !== '301') continue;
    // Columns after the id: reference, frame, epoch, a, e, w, M, i, node, P, Pw, Pnode.
    const rest = cells.slice(i + 2);
    const nums = rest.slice(3, 12).map(Number);
    if (rest.length < 12 || nums.some((n) => !Number.isFinite(n))) throw new Error('JPL satellite elements: the Moon row is incomplete');
    const [aKm, e, argPeriDeg, meanAnomalyDeg, iDeg, nodeDeg, siderealPeriodDays, apsisPeriodYears, nodePeriodYears] = nums as [number, number, number, number, number, number, number, number, number];
    return {
      epoch: rest[2]!, aKm, e, argPeriDeg, meanAnomalyDeg, iDeg, nodeDeg, siderealPeriodDays, apsisPeriodYears, nodePeriodYears,
      hasEphemerisWarning: /not intended for ephemeris computation/i.test(cellText(root)),
    };
  }
  throw new Error('JPL satellite elements: no Moon row (NAIF 301) found');
}
