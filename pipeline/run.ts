import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageryFileSchema } from '../src/core/catalog/schema';
import { buildSolarSystem } from './build/buildSolarSystem';
import { validateOutput } from './build/validate';
import { fetchCached, type FetchedText, type FetchOptions } from './lib/fetchCached';
import type { HorizonsReference } from './sources/horizons';
import { DESCRIPTION_PAGES } from './sources/nasaScience';
import { SOURCE_SPECS } from './sources/registry';

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
  const descriptions = {} as Record<keyof typeof DESCRIPTION_PAGES, FetchedText>;
  for (const [id, url] of Object.entries(DESCRIPTION_PAGES) as Array<[keyof typeof DESCRIPTION_PAGES, string]>) {
    descriptions[id] = await fetchCached(url, `nasa-science-${id}.html`, options);
  }
  const horizons = JSON.parse(await readFile('pipeline/reference/horizons-heliocentric.json', 'utf8')) as HorizonsReference;

  const imagery = ImageryFileSchema.parse(JSON.parse(await readFile('public/textures/imagery.json', 'utf8')));

  const output = buildSolarSystem({ approxPos, planetSheet, sunSheet, pck, descriptions, horizons, imagery }, new Date().toISOString());
  const errors = validateOutput(output);
  if (errors.length > 0) {
    console.error(`Validation failed; public/data was NOT changed:\n${errors.join('\n')}`);
    process.exit(1);
  }
  await writeJson(path.join(OUT_DIR, 'regions.json'), output.regions);
  await writeJson(path.join(OUT_DIR, 'sources.json'), output.sources);
  await writeJson(path.join(OUT_DIR, 'solar-system/bodies.json'), output.bodies);
  console.log(`Wrote ${output.bodies.bodies.length} bodies and ${output.sources.sources.length} sources to ${OUT_DIR}`);
} catch (error) {
  console.error(`Data pipeline failed; public/data was NOT changed.\n${String(error)}`);
  process.exit(1);
}
