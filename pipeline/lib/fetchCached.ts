import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface FetchedText {
  text: string;
  retrievedAt: string;
  fromCache: boolean;
}

export interface FetchOptions {
  offline: boolean;
  rawDir: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  log?: (message: string) => void;
  /** Give up on a request (headers and body) after this long, then use the cached copy if there is one. */
  timeoutMs?: number;
}

/**
 * A request that takes longer is abandoned. Without a limit a service that accepts the connection and never answers stalled
 * `npm run data` for about 5 minutes per file (NRCan, 2026-11-19). Two minutes still covers the largest file
 * (the LINZ gazetteer, about 21 MB) on a slow line.
 */
export const FETCH_TIMEOUT_MS = 120_000;

const USER_AGENT = 'Mozilla/5.0 (compatible; solar-system-visualizer-data-pipeline)';

export async function fetchCached(url: string, cacheName: string, options: FetchOptions): Promise<FetchedText> {
  const file = path.join(options.rawDir, cacheName);
  const metaFile = `${file}.meta.json`;

  const readCache = async (): Promise<FetchedText | null> => {
    if (!existsSync(file) || !existsSync(metaFile)) return null;
    const meta = JSON.parse(await readFile(metaFile, 'utf8')) as { retrievedAt: string };
    return { text: await readFile(file, 'utf8'), retrievedAt: meta.retrievedAt, fromCache: true };
  };

  if (options.offline) {
    const cached = await readCache();
    if (!cached) throw new Error(`Offline mode: no cached copy of ${url} at ${file}`);
    return cached;
  }

  try {
    const res = await (options.fetchImpl ?? fetch)(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(options.timeoutMs ?? FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = await res.text();
    // An empty body with HTTP 200 happened on 2026-11-19 (two JPL news pages); caching it erased the good copy.
    if (text.trim() === '') throw new Error(`empty response for ${url}`);
    const retrievedAt = (options.now ?? (() => new Date()))().toISOString().slice(0, 10);
    await mkdir(options.rawDir, { recursive: true });
    await writeFile(file, text, 'utf8');
    await writeFile(metaFile, JSON.stringify({ url, retrievedAt }, null, 2), 'utf8');
    return { text, retrievedAt, fromCache: false };
  } catch (error) {
    const cached = await readCache();
    if (cached) {
      options.log?.(`WARN fetch failed for ${url} (${String(error)}); using cached copy from ${cached.retrievedAt}`);
      return cached;
    }
    throw new Error(`Could not fetch ${url} and no cached copy exists: ${String(error)}`);
  }
}
