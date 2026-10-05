import path from 'node:path';
import { buildTextures } from './build';

const hd = process.argv.includes('--hd');
const offline = process.argv.includes('--offline');
try {
  const file = await buildTextures({ hd, offline, rawDir: path.resolve('pipeline/raw/textures'), outDir: path.resolve('public/textures'), log: (m) => console.log(m) });
  console.log(`Imagery for ${Object.keys(file.bodies).length} bodies from ${file.sources.length} sources written to public/textures/imagery.json`);
} catch (error) {
  console.error(`Texture pipeline failed; imagery.json was NOT updated.\n${error instanceof Error ? error.stack : String(error)}`);
  process.exit(1);
}
