import { cellText, parseHtml } from '../lib/html';

export type FactCell = number | boolean | undefined;

/** "12,104" -> 12104, "0.384*" -> 0.384, "Yes"/"No" -> boolean, "Unknown*" or "" -> undefined. */
export function parseFactCell(raw: string): FactCell {
  const t = raw.replace(/\*/g, '').replace(/,/g, '').trim();
  if (t === '' || /^unknown$/i.test(t)) return undefined;
  if (/^yes$/i.test(t)) return true;
  if (/^no$/i.test(t)) return false;
  const n = Number(t);
  if (!Number.isFinite(n)) throw new Error(`Unrecognized fact sheet value "${raw}"`);
  return n;
}

export interface PlanetFactSheet {
  columns: string[];
  rows: Map<string, Map<string, FactCell>>;
}

export function parsePlanetFactSheet(html: string): PlanetFactSheet {
  const table = parseHtml(html).querySelector('table');
  if (!table) throw new Error('Planetary fact sheet: no table found');
  const trs = table.querySelectorAll('tr');
  const header = trs[0]?.querySelectorAll('td').map(cellText) ?? [];
  const columns = header.slice(1);
  if (columns.length === 0) throw new Error('Planetary fact sheet: header row has no columns');
  const rows = new Map<string, Map<string, FactCell>>();
  for (const tr of trs.slice(1)) {
    const cells = tr.querySelectorAll('td').map(cellText);
    const label = cells[0];
    if (!label) continue; // repeated header row at the bottom
    const values = new Map<string, FactCell>();
    columns.forEach((column, i) => values.set(column, parseFactCell(cells[i + 1] ?? '')));
    rows.set(label, values);
  }
  return { columns, rows };
}

/** Row labels carry units, e.g. "Mass (1024kg)"; match by prefix. */
export function planetFact(sheet: PlanetFactSheet, labelPrefix: string, column: string): FactCell {
  const entry = [...sheet.rows.entries()].find(
    ([label]) => label === labelPrefix || label.startsWith(`${labelPrefix} `) || label.startsWith(`${labelPrefix}(`),
  );
  if (!entry) throw new Error(`Fact sheet row "${labelPrefix}" not found`);
  if (!sheet.columns.includes(column)) throw new Error(`Fact sheet column "${column}" not found`);
  return entry[1].get(column);
}

/** Every table row of the form <th>label</th><td>Sun value</td>...; the first occurrence of a label wins. */
export function parseSunFactSheet(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const tr of parseHtml(html).querySelectorAll('tr')) {
    const ths = tr.querySelectorAll('th');
    const tds = tr.querySelectorAll('td');
    if (ths.length !== 1 || tds.length === 0) continue;
    const label = cellText(ths[0]!);
    if (label && !out.has(label)) out.set(label, cellText(tds[0]!));
  }
  return out;
}

export function sunFact(sheet: Map<string, string>, labelPrefix: string): string {
  const entry = [...sheet.entries()].find(([label]) => label.startsWith(labelPrefix));
  if (!entry) throw new Error(`Sun fact sheet label "${labelPrefix}" not found`);
  return entry[1];
}

/** "1,988,400." -> 1988400, "+4.83" -> 4.83. */
export function parseSunNumber(raw: string): number {
  const n = Number(raw.replace(/,/g, '').replace(/\.$/, '').replace(/^\+/, ''));
  if (!Number.isFinite(n)) throw new Error(`Sun fact sheet value is not a number: "${raw}"`);
  return n;
}
