import { ringsVisible } from './rings';

/**
 * Parts of the giants' colour maps that hold no imagery (illustrative fills, Explore only). Normal views keep the maps as
 * they are; in Explore the opened shell puts these parts centre stage, so they are filled from the nearest imagery:
 * - Saturn's map is black in a band at the equator (kept black under the rings). The rings hide in Explore, so the band is
 *   filled from the latitudes either side of it.
 * - The Hubble OPAL maps of Uranus and Neptune cover only the latitudes Hubble could see; beyond them the map is black with
 *   stretched streaks. MAP_COVERAGE is the range of the map's v (0 south edge, 1 north edge) that holds imagery, read by eye
 *   from color_1k.webp with a small margin; outside it the nearest covered row is used.
 */
export const MAP_COVERAGE: Readonly<Record<string, readonly [number, number]>> = {
  // Imagery from the north edge down to row ~265 of 512; streaks below it.
  uranus: [0.5, 1],
  // Black and streaks from the north edge to row ~150 of 512.
  neptune: [0, 0.68],
};

const FULL: readonly [number, number] = [0, 1];

/** True while this body is open in Explore (the same test that hides its rings). */
const openInExplore = (bodyId: string, explore: { bodyId: string; progress: number } | null) => !!explore && !ringsVisible(bodyId, explore);

/** Whether Saturn's (a ringed giant's) black equatorial band is filled: only while its rings are hidden in Explore. */
export function fillsMapBand(bodyId: string, hasRings: boolean, explore: { bodyId: string; progress: number } | null): boolean {
  return hasRings && openInExplore(bodyId, explore);
}

/** The v range of the colour map to sample: the covered latitudes while the body is open in Explore, else the whole map. */
export function mapCoverage(bodyId: string, explore: { bodyId: string; progress: number } | null): readonly [number, number] {
  return openInExplore(bodyId, explore) ? (MAP_COVERAGE[bodyId] ?? FULL) : FULL;
}
