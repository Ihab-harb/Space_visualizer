import { describe, expect, it } from 'vitest';
import { readDbf } from './dbf';

type Field = { name: string; type: 'C' | 'N'; len: number };

function makeDbf(fields: Field[], rows: string[][], deletedRows: number[] = []): Buffer {
  const headerLen = 32 + 32 * fields.length + 1;
  const recLen = 1 + fields.reduce((s, f) => s + f.len, 0);
  const header = Buffer.alloc(headerLen);
  header[0] = 3;
  header.writeUInt32LE(rows.length, 4);
  header.writeUInt16LE(headerLen, 8);
  header.writeUInt16LE(recLen, 10);
  fields.forEach((f, i) => {
    const o = 32 + 32 * i;
    header.write(f.name, o, 'latin1');
    header.write(f.type, o + 11, 'latin1');
    header[o + 16] = f.len;
  });
  header[headerLen - 1] = 0x0d;
  const recs = rows.map((row, r) => {
    const rec = Buffer.alloc(recLen, 0x20);
    rec[0] = deletedRows.includes(r) ? 0x2a : 0x20;
    let o = 1;
    fields.forEach((f, i) => {
      const b = Buffer.from(row[i] ?? '', 'utf8');
      if (f.type === 'N') b.copy(rec, o + f.len - b.length);
      else b.copy(rec, o);
      o += f.len;
    });
    return rec;
  });
  return Buffer.concat([header, ...recs, Buffer.from([0x1a])]);
}

describe('readDbf', () => {
  const fields: Field[] = [
    { name: 'name', type: 'C', len: 20 },
    { name: 'diameter', type: 'N', len: 12 },
  ];

  it('round-trips rows, trimming padding', () => {
    const rows = readDbf(makeDbf(fields, [['Olympus Mons', '648.9'], ['Gale', '154']]));
    expect(rows).toEqual([
      { name: 'Olympus Mons', diameter: '648.9' },
      { name: 'Gale', diameter: '154' },
    ]);
  });

  it('skips deleted records', () => {
    const rows = readDbf(makeDbf(fields, [['A', '1'], ['B', '2'], ['C', '3']], [1]));
    expect(rows.map((r) => r.name)).toEqual(['A', 'C']);
  });

  it('decodes UTF-8', () => {
    const rows = readDbf(makeDbf(fields, [['Jürgen', '5']]));
    expect(rows[0].name).toBe('Jürgen');
  });
});
