/** Reads a dBASE III file into rows of trimmed UTF-8 strings keyed by field name. Deleted records are skipped. */
export function readDbf(buf: Buffer): Array<Record<string, string>> {
  const count = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);
  const recLen = buf.readUInt16LE(10);
  const fields: Array<{ name: string; len: number }> = [];
  for (let o = 32; o < headerLen && buf[o] !== 0x0d; o += 32) {
    const raw = buf.subarray(o, o + 11);
    const end = raw.indexOf(0);
    fields.push({ name: raw.toString('latin1', 0, end < 0 ? 11 : end), len: buf[o + 16] });
  }
  const rows: Array<Record<string, string>> = [];
  for (let r = 0; r < count; r++) {
    const start = headerLen + r * recLen;
    if (start + recLen > buf.length) throw new Error('dbf: truncated record data');
    if (buf[start] === 0x2a) continue;
    const row: Record<string, string> = {};
    let o = start + 1;
    for (const f of fields) {
      row[f.name] = buf.toString('utf8', o, o + f.len).trim();
      o += f.len;
    }
    rows.push(row);
  }
  return rows;
}
