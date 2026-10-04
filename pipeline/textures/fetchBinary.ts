import { createWriteStream, existsSync, statSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export interface BinaryFetchOptions {
  offline: boolean;
  rawDir: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  log?: (message: string) => void;
}

export interface FetchedFile {
  path: string;
  retrievedAt: string;
  fromCache: boolean;
  bytes: number;
}

interface Meta {
  url: string;
  retrievedAt: string;
  bytes: number;
}

async function readCompleteCache(file: string, metaFile: string): Promise<FetchedFile | null> {
  if (!existsSync(file) || !existsSync(metaFile)) return null;
  try {
    const meta = JSON.parse(await readFile(metaFile, 'utf8')) as Meta;
    if (typeof meta.bytes !== 'number') return null;
    if (statSync(file).size !== meta.bytes) return null;
    return { path: file, retrievedAt: meta.retrievedAt, fromCache: true, bytes: meta.bytes };
  } catch {
    return null;
  }
}

export async function fetchBinaryCached(url: string, cacheName: string, options: BinaryFetchOptions): Promise<FetchedFile> {
  const file = path.join(options.rawDir, cacheName);
  const metaFile = `${file}.meta.json`;
  const metaPartFile = `${metaFile}.part`;
  const partFile = `${file}.part`;

  const cached = await readCompleteCache(file, metaFile);
  if (cached) return cached;
  if (options.offline) throw new Error(`Offline mode: no complete cached copy of ${url} at ${file}`);

  await mkdir(options.rawDir, { recursive: true });
  try {
    const res = await (options.fetchImpl ?? fetch)(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; solar-system-visualizer-texture-pipeline)' } });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`);
    const expected = res.headers.get('content-length');
    options.log?.(`downloading ${url}${expected ? ` (${(Number(expected) / 1e6).toFixed(0)} MB)` : ''}`);
    await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), createWriteStream(partFile));
    const bytes = statSync(partFile).size;
    if (expected !== null && Number(expected) !== bytes) throw new Error(`Download of ${url} incomplete: expected ${expected} bytes, got ${bytes}`);
    await rename(partFile, file);
    const retrievedAt = (options.now ?? (() => new Date()))().toISOString().slice(0, 10);
    await writeFile(metaPartFile, JSON.stringify({ url, retrievedAt, bytes } satisfies Meta, null, 2), 'utf8');
    await rename(metaPartFile, metaFile);
    return { path: file, retrievedAt, fromCache: false, bytes };
  } catch (error) {
    await rm(partFile, { force: true });
    await rm(metaPartFile, { force: true });
    throw error;
  }
}
