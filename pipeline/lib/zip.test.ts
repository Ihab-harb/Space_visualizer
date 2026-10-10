import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { readZipEntry } from './zip';

function makeZip(entries: Array<{ name: string; data: Buffer; deflate: boolean }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name);
    const body = e.deflate ? deflateRawSync(e.data) : e.data;
    const method = e.deflate ? 8 : 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(4, 28);
    const extra = Buffer.alloc(4, 0xab);
    locals.push(local, name, extra, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + extra.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

describe('readZipEntry', () => {
  const stored = Buffer.from('stored bytes ü\u0000ÿ');
  const big = Buffer.from('deflate me '.repeat(500));
  const zip = makeZip([
    { name: 'dir/a.txt', data: stored, deflate: false },
    { name: 'dir/B.DBF', data: big, deflate: true },
  ]);

  it('returns a stored entry byte for byte', () => {
    expect(readZipEntry(zip, 'a.txt').equals(stored)).toBe(true);
  });

  it('inflates a deflated entry byte for byte', () => {
    expect(readZipEntry(zip, '.DBF').equals(big)).toBe(true);
  });

  it('throws for a missing suffix', () => {
    expect(() => readZipEntry(zip, '.shp')).toThrow('zip: no entry ending with .shp');
  });

  it('throws for a truncated archive', () => {
    expect(() => readZipEntry(zip.subarray(0, zip.length - 30), 'a.txt')).toThrow(/zip/);
    const one = makeZip([{ name: 'a.txt', data: stored, deflate: false }]);
    // cut the stored data short but keep the central directory intact
    const cut = Buffer.concat([one.subarray(0, 30 + 5 + 4 + 3), one.subarray(30 + 5 + 4 + stored.length)]);
    expect(() => readZipEntry(cut, 'a.txt')).toThrow(/zip: /);
  });

  it('throws for stored data that runs past the end of the buffer', () => {
    const one = makeZip([{ name: 'a.txt', data: stored, deflate: false }]);
    const eocd = one.length - 22;
    const bad = Buffer.from(one);
    bad.writeUInt32LE(one.length, eocd + 16); // central directory offset beyond the end
    expect(() => readZipEntry(bad, 'a.txt')).toThrow('zip: truncated archive');
  });

  it('rejects ZIP64 sentinels', () => {
    const z = Buffer.from(zip);
    z.writeUInt16LE(0xffff, z.length - 22 + 10);
    expect(() => readZipEntry(z, 'a.txt')).toThrow('zip: ZIP64 archives are not supported');
    const z2 = Buffer.from(zip);
    z2.writeUInt32LE(0xffffffff, z2.length - 22 + 16);
    expect(() => readZipEntry(z2, 'a.txt')).toThrow('zip: ZIP64 archives are not supported');
  });

  it('throws on a size mismatch', () => {
    const one = makeZip([{ name: 'a.txt', data: stored, deflate: false }]);
    const cd = one.length - 22 - (46 + 5);
    const bad = Buffer.from(one);
    bad.writeUInt32LE(stored.length + 1, cd + 24);
    expect(() => readZipEntry(bad, 'a.txt')).toThrow('zip: size mismatch');
  });

  it('throws for a buffer that is not a zip', () => {
    expect(() => readZipEntry(Buffer.from('nope'), '.dbf')).toThrow(/zip/);
  });
});
