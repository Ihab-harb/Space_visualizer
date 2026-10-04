import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { horizonsVectorUrl, parseHorizonsVector, REFERENCE_BODIES, REFERENCE_JDS, REFERENCE_QUERY, type HorizonsReference } from '../sources/horizons';

const OUT = path.resolve('pipeline/reference/horizons-heliocentric.json');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchVector(command: string, jdTdb: number) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await sleep(400); // be polite to the Horizons API
      const res = await fetch(horizonsVectorUrl(command, jdTdb));
      const json = (await res.json()) as { result?: string; error?: string };
      if (json.error) throw new Error(json.error);
      return parseHorizonsVector(json.result ?? '');
    } catch (error) {
      lastError = error;
      console.warn(`retry ${attempt + 1} for ${command} @ ${jdTdb}: ${String(error)}`);
      await sleep(3000);
    }
  }
  throw lastError;
}

const samples: HorizonsReference['samples'] = [];
for (const { body, command } of REFERENCE_BODIES) {
  for (const jdTdb of REFERENCE_JDS) {
    const p = await fetchVector(command, jdTdb);
    samples.push({ body, command, jdTdb, positionKm: [p[0], p[1], p[2]] });
    console.log(`${body} ${jdTdb} ok`);
  }
}
const reference: HorizonsReference = { retrievedAt: new Date().toISOString().slice(0, 10), query: REFERENCE_QUERY, samples };
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(reference, null, 2)}\n`, 'utf8');
console.log(`wrote ${samples.length} samples to ${OUT}`);
