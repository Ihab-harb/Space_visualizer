import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ChebyshevFileSchema, ImageryFileSchema } from '../src/core/catalog/schema';
import { buildDetails, type DetailsInputs } from './build/buildDetails';
import { buildSolarSystem } from './build/buildSolarSystem';
import { validateDetails, validateOutput } from './build/validate';
import { fetchCached, type FetchedText, type FetchOptions } from './lib/fetchCached';
import type { HorizonsMoonCheck, HorizonsReference } from './sources/horizons';
import { DESCRIPTION_PAGES } from './sources/nasaScience';
import { readDbf } from './lib/dbf';
import { readZipEntry } from './lib/zip';
import { GAZETTEER_TARGETS, gazetteerUrl } from './sources/gazetteer';
import { PLANET_SHEET_IDS } from './sources/nssdcPlanetSheet';
import type { InteriorsFile, MissionsFile } from './sources/quotedReference';
import { planetSheetUrl, SOURCE_SPECS } from './sources/registry';
import { fetchBinaryCached } from './textures/fetchBinary';

const options: FetchOptions = {
  offline: process.argv.includes('--offline'),
  rawDir: path.resolve('pipeline/raw'),
  log: (message) => console.warn(message),
};
const OUT_DIR = path.resolve('public/data');

async function writeJson(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

try {
  const approxPos = await fetchCached(SOURCE_SPECS.jplApproxPos.url, 'approx_pos.html', options);
  const planetSheet = await fetchCached(SOURCE_SPECS.nssdcaPlanets.url, 'planet-factsheet.html', options);
  const sunSheet = await fetchCached(SOURCE_SPECS.nssdcaSun.url, 'sun-factsheet.html', options);
  const pck = await fetchCached(SOURCE_SPECS.naifPck.url, 'pck00011.tpc', options);
  const gmKernel = await fetchCached(SOURCE_SPECS.naifGm.url, 'gm_de440.tpc', options);
  const moonSheet = await fetchCached(planetSheetUrl('moon'), 'nssdca-moon-fact.html', options);
  const satElemPage = await fetchCached(SOURCE_SPECS.jplSatElem.url, 'jpl-sats-elem.html', options);
  const descriptions = {} as Record<keyof typeof DESCRIPTION_PAGES, FetchedText>;
  for (const [id, url] of Object.entries(DESCRIPTION_PAGES) as Array<[keyof typeof DESCRIPTION_PAGES, string]>) {
    descriptions[id] = await fetchCached(url, `nasa-science-${id}.html`, options);
  }
  const horizons = JSON.parse(await readFile('pipeline/reference/horizons-heliocentric.json', 'utf8')) as HorizonsReference;

  const moonTable = ChebyshevFileSchema.parse(JSON.parse(await readFile('public/data/solar-system/ephemeris/moon.json', 'utf8')));
  const moonCheck = JSON.parse(await readFile('pipeline/reference/horizons-moon-check.json', 'utf8')) as HorizonsMoonCheck;

  const imagery = ImageryFileSchema.parse(JSON.parse(await readFile('public/textures/imagery.json', 'utf8')));

  const output = buildSolarSystem({ approxPos, planetSheet, sunSheet, pck, gmKernel, moonSheet, satElemPage, moonTable, moonCheck, descriptions, horizons, imagery }, new Date().toISOString());

  const generatedAt = output.bodies.generatedAt;
  const planetSheets = {} as DetailsInputs['planetSheets'];
  for (const id of PLANET_SHEET_IDS) planetSheets[id] = await fetchCached(planetSheetUrl(id), `nssdca-${id}-fact.html`, options);
  const gazetteer: DetailsInputs['gazetteer'] = {};
  for (const [id, target] of Object.entries(GAZETTEER_TARGETS) as Array<[keyof typeof GAZETTEER_TARGETS, (typeof GAZETTEER_TARGETS)[keyof typeof GAZETTEER_TARGETS]]>) {
    const zip = await fetchBinaryCached(gazetteerUrl(target), `gazetteer-${target}.zip`, options);
    gazetteer[id] = { rows: readDbf(readZipEntry(await readFile(zip.path), '.dbf')), retrievedAt: zip.retrievedAt };
  }
  const interiors = JSON.parse(await readFile('pipeline/reference/interiors.json', 'utf8')) as InteriorsFile;
  const missions = JSON.parse(await readFile('pipeline/reference/missions.json', 'utf8')) as MissionsFile;
  const curatedPages = new Map<string, FetchedText>();
  for (const s of [...interiors.sources, ...missions.sources]) {
    if (!curatedPages.has(s.id)) curatedPages.set(s.id, await fetchCached(s.url, `ref-${s.id}.html`, options));
  }
  const built = buildDetails(
    { bodies: output.bodies.bodies, existingSourceIds: new Set(output.sources.sources.map((s) => s.id)), existingSourceUrls: new Map(output.sources.sources.map((s) => [s.url, s.id])), planetSheets, sunSheet, gazetteer, interiors, missions, curatedPages },
    generatedAt,
  );
  output.sources.sources.push(...built.sources);

  const errors = [...validateOutput(output, new Map([['solar-system/ephemeris/moon.json', moonTable]])), ...built.errors, ...validateDetails(built.details, output)];
  if (errors.length > 0) {
    console.error(`Validation failed; public/data was NOT changed:\n${errors.join('\n')}`);
    process.exit(1);
  }
  await writeJson(path.join(OUT_DIR, 'regions.json'), output.regions);
  await writeJson(path.join(OUT_DIR, 'sources.json'), output.sources);
  await writeJson(path.join(OUT_DIR, 'solar-system/bodies.json'), output.bodies);
  for (const d of built.details) await writeJson(path.join(OUT_DIR, `solar-system/details/${d.bodyId}.json`), d);
  console.log(`Wrote ${output.bodies.bodies.length} bodies and ${output.sources.sources.length} sources and ${built.details.length} details files to ${OUT_DIR}`);
} catch (error) {
  console.error(`Data pipeline failed; public/data was NOT changed.\n${String(error)}`);
  process.exit(1);
}
