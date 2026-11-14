import { inflateRawSync } from 'node:zlib';

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;
const MAX32 = 0xffffffff;

function need(zip: Buffer, end: number): void {
  if (end > zip.length) throw new Error('zip: truncated archive');
}

/** Returns the contents of the first entry whose name ends with `nameSuffix`. Sizes come from the central directory. */
export function readZipEntry(zip: Buffer, nameSuffix: string): Buffer {
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (zip.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('zip: end of central directory not found');
  const count = zip.readUInt16LE(eocd + 10);
  const cdSize = zip.readUInt32LE(eocd + 12);
  let p = zip.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdSize === MAX32 || p === MAX32) throw new Error('zip: ZIP64 archives are not supported');
  need(zip, p + cdSize);
  for (let n = 0; n < count; n++) {
    need(zip, p + 46);
    if (zip.readUInt32LE(p) !== CENTRAL_SIG) throw new Error('zip: bad central directory entry');
    const method = zip.readUInt16LE(p + 10);
    const compSize = zip.readUInt32LE(p + 20);
    const rawSize = zip.readUInt32LE(p + 24);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const localOffset = zip.readUInt32LE(p + 42);
    need(zip, p + 46 + nameLen);
    const name = zip.toString('utf8', p + 46, p + 46 + nameLen);
    if (name.endsWith(nameSuffix)) {
      if (compSize === MAX32 || rawSize === MAX32 || localOffset === MAX32) {
        throw new Error('zip: ZIP64 archives are not supported');
      }
      need(zip, localOffset + 30);
      if (zip.readUInt32LE(localOffset) !== LOCAL_SIG) throw new Error('zip: bad local header');
      const start = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
      need(zip, start + compSize);
      const data = zip.subarray(start, start + compSize);
      let out: Buffer;
      if (method === 0) out = Buffer.from(data);
      else if (method === 8) out = inflateRawSync(data);
      else throw new Error(`zip: unsupported compression ${method}`);
      if (out.length !== rawSize) throw new Error('zip: size mismatch');
      return out;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`zip: no entry ending with ${nameSuffix}`);
}
