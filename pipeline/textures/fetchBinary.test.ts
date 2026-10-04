import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
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
    expect(existsSync(path.join(rawDir, 'c.bin.part'))).toBe(false);
  });

  it('offline mode requires a complete cached copy', async () => {
    await expect(fetchBinaryCached('https://example.org/d.bin', 'd.bin', { offline: true, rawDir: await tempDir() })).rejects.toThrow(/Offline mode: no complete cached copy/);
  });

  it('re-fetches when cached file size differs from meta.bytes', async () => {
    const rawDir = await tempDir();
    const file = path.join(rawDir, 'e.bin');
    const metaFile = `${file}.meta.json`;

    // Create cache with wrong size
    await writeFile(file, bytes(100));
    await writeFile(metaFile, JSON.stringify({ url: 'https://example.org/e.bin', retrievedAt: '2026-10-04', bytes: 50 }));

    // Should re-fetch because size mismatch
    const fetchFn = okFetch(bytes(100));
    const result = await fetchBinaryCached('https://example.org/e.bin', 'e.bin', { offline: false, rawDir, fetchImpl: fetchFn });

    expect(result.fromCache).toBe(false);
    expect(fetchFn).toHaveBeenCalled();
  });

  it('re-fetches when cached file has no meta file', async () => {
    const rawDir = await tempDir();
    const file = path.join(rawDir, 'f.bin');

    // Create cache without meta file
    await writeFile(file, bytes(100));

    // Should re-fetch because no meta file
    const fetchFn = okFetch(bytes(100));
    const result = await fetchBinaryCached('https://example.org/f.bin', 'f.bin', { offline: false, rawDir, fetchImpl: fetchFn });

    expect(result.fromCache).toBe(false);
    expect(fetchFn).toHaveBeenCalled();
  });

  it('re-fetches when meta file is corrupt', async () => {
    const rawDir = await tempDir();
    const file = path.join(rawDir, 'g.bin');
    const metaFile = `${file}.meta.json`;

    // Create cache with corrupt meta (truncated JSON)
    await writeFile(file, bytes(100));
    await writeFile(metaFile, '{"bytes":');

    // Should re-fetch because meta is corrupt
    const fetchFn = okFetch(bytes(100));
    const result = await fetchBinaryCached('https://example.org/g.bin', 'g.bin', { offline: false, rawDir, fetchImpl: fetchFn });

    expect(result.fromCache).toBe(false);
    expect(fetchFn).toHaveBeenCalled();
  });

  it('throws not-cached error for corrupt meta in offline mode', async () => {
    const rawDir = await tempDir();
    const file = path.join(rawDir, 'h.bin');
    const metaFile = `${file}.meta.json`;

    // Create cache with corrupt meta (truncated JSON)
    await writeFile(file, bytes(100));
    await writeFile(metaFile, '{"bytes":');

    // Should throw "not cached" error because meta is corrupt
    await expect(fetchBinaryCached('https://example.org/h.bin', 'h.bin', { offline: true, rawDir })).rejects.toThrow(/Offline mode: no complete cached copy/);
  });
});
