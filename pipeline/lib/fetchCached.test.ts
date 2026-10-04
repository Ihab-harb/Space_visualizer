import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fetchCached } from './fetchCached';

const okFetch = (text: string) => (async () => new Response(text, { status: 200 })) as unknown as typeof fetch;
const failFetch = (async () => {
  throw new Error('network down');
}) as unknown as typeof fetch;
const now = () => new Date('2026-10-04T10:00:00Z');
const tempDir = () => mkdtemp(path.join(os.tmpdir(), 'ssv-pipeline-'));

describe('fetchCached', () => {
  it('fetches, caches and stamps the retrieval date', async () => {
    const rawDir = await tempDir();
    const result = await fetchCached('https://example.org/a', 'a.html', { offline: false, rawDir, fetchImpl: okFetch('hello'), now });
    expect(result).toEqual({ text: 'hello', retrievedAt: '2026-10-04', fromCache: false });
    expect(await readFile(path.join(rawDir, 'a.html'), 'utf8')).toBe('hello');
  });

  it('falls back to the cached copy and logs a warning when the network fails', async () => {
    const rawDir = await tempDir();
    await fetchCached('https://example.org/a', 'a.html', { offline: false, rawDir, fetchImpl: okFetch('cached'), now });
    const log = vi.fn();
    const result = await fetchCached('https://example.org/a', 'a.html', { offline: false, rawDir, fetchImpl: failFetch, log });
    expect(result).toEqual({ text: 'cached', retrievedAt: '2026-10-04', fromCache: true });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('using cached copy'));
  });

  it('throws when the network fails and nothing is cached', async () => {
    await expect(fetchCached('https://example.org/b', 'b.html', { offline: false, rawDir: await tempDir(), fetchImpl: failFetch })).rejects.toThrow(/no cached copy/);
  });

  it('treats HTTP errors as failures', async () => {
    const notFound = (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch;
    await expect(fetchCached('https://example.org/c', 'c.html', { offline: false, rawDir: await tempDir(), fetchImpl: notFound })).rejects.toThrow(/HTTP 404/);
  });

  it('offline mode reads only the cache', async () => {
    await expect(fetchCached('https://example.org/d', 'd.html', { offline: true, rawDir: await tempDir() })).rejects.toThrow(/Offline mode/);
  });
});
