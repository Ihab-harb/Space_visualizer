import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fetchBinaryCached } from './fetchBinary';

const tempDir = () => mkdtemp(path.join(os.tmpdir(), 'ssv-bin-'));
const now = () => new Date('2026-10-04T10:00:00Z');
const bytes = (n: number) => new Uint8Array(n).map((_, i) => i % 251);

function okFetch(body: Uint8Array, contentLength: number | null = body.length) {
  return vi.fn(async () =>
    new Response(body as BodyInit, { status: 200, headers: contentLength === null ? {} : { 'content-length': String(contentLength) } }),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

function brokenFetch() {
  return (async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes(1000));
        controller.error(new Error('connection reset'));
      },
    });
    return new Response(stream, { status: 200, headers: { 'content-length': '5000' } });
  }) as unknown as typeof fetch;
}

describe('fetchBinaryCached', () => {
  it('downloads to the cache with metadata', async () => {
    const rawDir = await tempDir();
    const result = await fetchBinaryCached('https://example.org/a.bin', 'a.bin', { offline: false, rawDir, fetchImpl: okFetch(bytes(4096)), now });
    expect(result).toMatchObject({ fromCache: false, bytes: 4096, retrievedAt: '2026-10-04' });
    expect((await readFile(result.path)).length).toBe(4096);
  });

  it('uses the cache without fetching again', async () => {
    const rawDir = await tempDir();
    await fetchBinaryCached('https://example.org/a.bin', 'a.bin', { offline: false, rawDir, fetchImpl: okFetch(bytes(10)), now });
    const second = okFetch(bytes(10));
    const result = await fetchBinaryCached('https://example.org/a.bin', 'a.bin', { offline: false, rawDir, fetchImpl: second });
    expect(result.fromCache).toBe(true);
    expect(second).not.toHaveBeenCalled();
  });

  it('leaves nothing behind when the stream fails part-way', async () => {
    const rawDir = await tempDir();
    await expect(fetchBinaryCached('https://example.org/b.bin', 'b.bin', { offline: false, rawDir, fetchImpl: brokenFetch() })).rejects.toThrow(/connection reset/);
    expect(await readdir(rawDir)).toEqual([]);
  });

  it('rejects a short download that does not match Content-Length', async () => {
    const rawDir = await tempDir();
    await expect(fetchBinaryCached('https://example.org/c.bin', 'c.bin', { offline: false, rawDir, fetchImpl: okFetch(bytes(100), 200) })).rejects.toThrow(/expected 200 bytes, got 100/);
    expect(existsSync(path.join(rawDir, 'c.bin'))).toBe(false);
  });

  it('offline mode requires a complete cached copy', async () => {
    await expect(fetchBinaryCached('https://example.org/d.bin', 'd.bin', { offline: true, rawDir: await tempDir() })).rejects.toThrow(/Offline mode: no complete cached copy/);
  });
});
