// Writes the vault's sources register from the committed data, so it cannot drift from what the app cites.
// Run: node scripts/sources-register.mjs   (reads public/data and public/textures; writes Space_visualizer/Handbook/Sources register.md)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const sources = read('public/data/sources.json');
const list = Array.isArray(sources) ? sources : sources.sources;

/** Every place a source is cited: "<file>: <body> <field path>" with array indices dropped. */
const uses = new Map(list.map((s) => [s.id, new Set()]));
const ref = (id, where) => { if (uses.has(id)) uses.get(id).add(where); };

function walk(node, path, file, body) {
  if (Array.isArray(node)) { node.forEach((x) => walk(x, path, file, body)); return; }
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (/sourceId$/i.test(k) && typeof v === 'string') ref(v, `${file}: ${body ? body + ' ' : ''}${(path ? path + '.' : '') + k}`.replace(/\.sourceId$/i, ''));
    else if (/sourceIds$/i.test(k) && Array.isArray(v)) v.forEach((id) => ref(id, `${file}: ${body ? body + ' ' : ''}${path || k}`));
    else walk(v, path ? `${path}.${k}` : k, file, body);
  }
}

const bodies = read('public/data/solar-system/bodies.json').bodies;
for (const b of bodies) walk(b, '', 'bodies.json', b.id);
for (const f of readdirSync('public/data/solar-system/details')) {
  const d = read(`public/data/solar-system/details/${f}`);
  walk(d, '', 'details', f.replace('.json', ''));
}
walk(read('public/textures/imagery.json'), '', 'imagery.json', '');

/** Fold the field paths of one source into a short phrase per body. */
function summary(id) {
  const byBody = new Map();
  for (const u of uses.get(id)) {
    const m = u.match(/^([^:]+): (\S+)?\s?(.*)$/);
    const body = m[2] && !m[3] ? '' : (m[2] ?? '');
    let field = (m[3] || m[2] || '').replace(/^(facts|details)\./, '');
    field = field.split('.').slice(0, 2).join('.');
    const key = `${m[1] === 'details' ? 'details' : m[1]}${body ? ' · ' + body : ''}`;
    if (!byBody.has(key)) byBody.set(key, new Set());
    byBody.get(key).add(field);
  }
  return [...byBody].map(([k, fs]) => `${k}: ${[...fs].slice(0, 6).join(', ')}${fs.size > 6 ? ` (+${fs.size - 6})` : ''}`).join('; ') || 'not cited by any value (see note)';
}

/** The family a source belongs to, by host, with the reason the project trusts it. */
const FAMILIES = [
  [/naif\.jpl\.nasa\.gov|ssd\.jpl\.nasa\.gov/, 'NASA JPL and NAIF (ephemerides, constants, rotation)', 'JPL Solar System Dynamics and NAIF publish the ephemerides and constants that NASA missions themselves use; positions, rotation models and mass ratios come from here so the app agrees with Horizons.'],
  [/nssdc\.gsfc\.nasa\.gov/, 'NASA NSSDCA fact sheets and archive', 'NASA\'s archive of record for planetary facts, mission records and composition tables; one consistent, parseable set of numbers for every body.'],
  [/planetarynames\.wr\.usgs\.gov/, 'USGS and IAU Gazetteer of Planetary Nomenclature', 'The IAU\'s own register of approved feature names, kept by USGS: the only authority for names, positions and sizes of features on other worlds.'],
  [/astrogeology\.usgs\.gov|planetarymaps\.usgs\.gov/, 'USGS Astrogeology maps', 'USGS builds the standard global mosaics and elevation models from NASA mission data; used for surface imagery and relief.'],
  [/visibleearth\.nasa\.gov|svs\.gsfc\.nasa\.gov/, 'NASA imagery (Visible Earth, Scientific Visualization Studio)', 'NASA\'s published global maps (Blue Marble, Black Marble, CGI Moon Kit, Deep Star Maps); official imagery for Realistic mode.'],
  [/doi\.org/, 'Peer-reviewed papers (decision 0009)', 'Used only where no official source gives a number (interiors of Venus and the giants), from trusted journals, quote-checked on an open copy, and shown as Estimate.'],
  [/noaa\.gov|gebco\.net|natural-resources\.canada\.ca|linz\.govt\.nz|ga\.gov\.au|usgs\.gov\/(?:.*gnis|.*names)/i, 'Earth names databases (decision 0010)', 'Government or intergovernmental names databases, used only for the position (and class) of an Earth landmark; never for a quoted sentence; national ones only inside their country.'],
  [/esa\.int/, 'ESA pages', 'The European Space Agency is an official space agency; its mission pages supply quoted sentences for missions and landmarks.'],
  [/usgs\.gov/, 'USGS pages and publications', 'USGS is the United States\' official geological survey; its pages and publications supply quoted sentences (volcanoes, plate tectonics, Earth landmarks).'],
  [/nasa\.gov/, 'NASA science and mission pages', 'NASA\'s own pages; each value keeps the exact sentence it came from, checked against the fetched page at build time.'],
];
const familyOf = (url) => { const h = new URL(url).hostname + new URL(url).pathname; return FAMILIES.find(([re]) => re.test(h)) ?? [null, 'Other', '']; };

const groups = new Map();
for (const s of list) {
  const [, name, why] = familyOf(s.url);
  if (!groups.has(name)) groups.set(name, { why, rows: [] });
  groups.get(name).rows.push(s);
}

const esc = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
let out = `---
title: Sources register
tags: [handbook, sources]
generated: true
---

# Sources register

Back to [[Handbook]] · Rules: [[Rules#Sources]] · Decisions: [[Decision register#Sources]]

**Generated** by \`node scripts/sources-register.mjs\` from \`public/data/sources.json\`, \`bodies.json\`, the details files and \`public/textures/imagery.json\`. Do not edit by hand: rerun it after \`npm run data\`. It lists every source the app cites (${list.length} on ${new Date().toISOString().slice(0, 10)}), grouped by family, with **why the family is trusted** and **what each source supplies** (the data fields that cite it). Per-source research, licences and caveats are in the \`Data Sources/\` notes ([[Home#Data Sources]]).

| Family | Sources |
|---|---|
${[...groups].map(([n, g]) => `| [[#${n}]] | ${g.rows.length} |`).join('\n')}

`;
for (const [name, g] of groups) {
  out += `## ${name}\n\n**Why this family:** ${g.why}\n\n| Id | Title | Publisher | Licence | Retrieved | Supplies |\n|---|---|---|---|---|---|\n`;
  for (const s of g.rows) out += `| \`${s.id}\` | [${esc(s.title)}](${s.url}) | ${esc(s.publisher)} | ${esc(s.license)} | ${s.retrievedAt?.slice(0, 10) ?? ''} | ${esc(summary(s.id))} |\n`;
  out += '\n';
}
out += `## Sources considered and not used\n\nKept here so the reasons are not lost. Details are in the linked notes.\n\n| Source | Why not | Where recorded |\n|---|---|---|\n| Wikipedia, Wikidata, GeoNames.org, OpenStreetMap, Natural Earth, blogs, aggregators | Not official; the project cites only the publisher of record | [[Rules#Sources]] |\n| NGA GEOnet Names Server | Could not be reached from this network (timed out for every try, 2026-11-15); its format and licence were never confirmed. Kept defined but switched off | [[0010-names-databases-for-earth-positions]] |\n| UNESCO World Heritage list | Behind a browser challenge (HTTP 403); not fetchable by the pipeline | [[Earth names databases (GNIS, GNS)]] |\n| ArcGIS Online copies of official data | A commercial platform; the agency's own service is used instead | [[Earth names databases (GNIS, GNS)]] |\n| JPL mean elements for the Moon inside 1800–2050 | JPL warns they are "not intended for ephemeris computation"; measured far off. Used only outside the Horizons table | [[0008-moon-chebyshev-table]] |\n| Published limb-darkening coefficients | Could not be verified while planning M2a.1; the Sun's surface is illustrative | [[2026-10-04-m2a1-imagery-and-shading]] |\n| NASA PDS Ring-Moon Systems profiles | Need a heavy toolchain; NSSDCA ring fact sheets used instead | [[2026-10-04-m2a1-imagery-and-shading]] |\n| Dumoulin 2017, James 2013 (Venus interior papers) | Publisher pages refuse the fetcher and no open copy exists, so the quote cannot be checked | [[Peer-reviewed papers (interior estimates)]] |\n| Papers in journals outside the trusted list (MNRAS, Phil Trans, conference abstracts) | Not on the journal list in decision 0009 | [[0009-peer-reviewed-papers-for-estimates]] |\n| NASA image-centre coordinates ("Location: 3° S, 37° E") | The centre of a picture, not the place | [[0010-names-databases-for-earth-positions]] |\n`;

writeFileSync('Space_visualizer/Handbook/Sources register.md', out);
console.log(`Wrote ${list.length} sources in ${groups.size} families`);
for (const [n, g] of groups) console.log(' ', g.rows.length, n);
const unused = list.filter((s) => uses.get(s.id).size === 0).map((s) => s.id);
console.log('not cited by any value:', unused.join(', ') || 'none');
