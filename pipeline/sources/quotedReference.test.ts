import { describe, expect, it } from 'vitest';
import { OFFICIAL_HOSTS, type CuratedSource, kmIn, normaliseQuote, numbersIn, pageText, percentIn, quoteHasDate, quoteHasKm, quoteHasNumber, quoteHasPercent, quoteOnPage, verifyInteriors, verifyMissions } from './quotedReference';

const html = '<html><script>x</script><p>Mars has a core about 2,100 miles (3,400 km)&nbsp;wide &mdash; it&rsquo;s liquid.</p><p>Mariner 4 launched on Nov. 28, 1964, and flew past Mars on July 14, 1965.</p></html>';

describe('quoted references (Review Focus #1)', () => {
  it('normalises page text and finds quotes regardless of entities and dashes', () => {
    expect(pageText(html)).toContain("about 2,100 miles (3,400 km) wide - it's liquid.");
    expect(quoteOnPage('a core about 2,100 miles (3,400 km) wide', pageText(html))).toBe(true);
    expect(quoteOnPage('a core about 2,200 miles', pageText(html))).toBe(false);
  });
  it('matches whole numbers only, so km is accepted and miles is not mistaken for km', () => {
    const q = 'a core about 2,100 miles (3,400 km) wide';
    expect(numbersIn(q)).toEqual([2100, 3400]);
    expect(quoteHasNumber(q, 3400)).toBe(true);
    expect(quoteHasNumber(q, 340)).toBe(false);
    expect(numbersIn('between 1650–1675 km')).toEqual([1650, 1675]);
  });
  it('accepts only numbers stated in kilometres (the miles-first trap)', () => {
    const q = 'a core about 2,100 miles (3,400 km) wide';
    expect(kmIn(q)).toEqual([3400]);
    expect(quoteHasKm(q, 3400)).toBe(true);
    expect(quoteHasKm(q, 2100)).toBe(false);
    expect(kmIn('a core radius between 1,650 and 1,675 km')).toEqual([1650, 1675]);
    expect(kmIn('roughly 1650 to 1675 kilometers')).toEqual([1650, 1675]);
  });
  it('finds mission dates written several ways', () => {
    const q = ['Mariner 4 launched on Nov. 28, 1964, and flew past Mars on July 14, 1965.'];
    expect(quoteHasDate(q, '1964-11-28')).toBe(true);
    expect(quoteHasDate(q, '1965-07-14')).toBe(true);
    expect(quoteHasDate(q, '1965-07-15')).toBe(false);
  });
  it('reports a layer whose number is not in its quote', () => {
    const pages = new Map([['p', pageText(html)]]);
    const file = {
      sources: [{ id: 'p', title: 't', publisher: 'NASA', url: 'https://science.nasa.gov/mars', license: 'l' }],
      bodies: { mars: { layers: [{ id: 'core', name: 'Core', from: 'radius' as const, outer: { min: 2100, max: 2100, sourceId: 'p', quote: 'a core about 2,100 miles (3,400 km) wide' }, inner: { min: 0, max: 0, sourceId: 'p', quote: 'a core about 2,100 miles (3,400 km) wide' }, state: 'liquid' as const, composition: null, uncertain: false }] } },
    };
    expect(verifyInteriors(file, pages).join()).toMatch(/2100 km not in quote/); // 2,100 is miles in the quote
    file.bodies.mars.layers[0]!.outer.min = 3400;
    file.bodies.mars.layers[0]!.outer.max = 3400;
    expect(verifyInteriors(file, pages)).toEqual([]);
  });
  it('reports a mission quote missing from the page and an arrival date not in any quote', () => {
    const pages = new Map([['p', pageText(html)]]);
    const file = {
      sources: [{ id: 'p', title: 't', publisher: 'NASA', url: 'https://science.nasa.gov/mars', license: 'l' }],
      bodies: { mars: { discovery: { kind: 'antiquity' as const, sourceId: 'p', quote: 'a core about 2,100 miles (3,400 km) wide' }, missions: [{ id: 'mariner-4', name: 'Mariner 4', agency: 'NASA', type: 'flyby' as const, launchDate: '1964-11-28', arrivalDate: '1965-07-15', endDate: null, outcome: 'success' as const, sourceId: 'p', quotes: ['Mariner 4 launched on Nov. 28, 1964, and flew past Mars on July 14, 1965.'] }] } },
    };
    expect(verifyMissions(file, pages).join()).toMatch(/mariner-4.*arrival 1965-07-15/);
  });
});

describe('page text and quote normalisation', () => {
  it('straightens curly quotes, dashes and NBSP in both page and quote', () => {
    expect(normaliseQuote('“it’s” a—b–c d')).toBe('"it\'s" a-b-c d');
    expect(quoteOnPage('it’s  a—b', pageText('<p>it&#8217;s a&ndash;b</p>'))).toBe(true);
  });
  it('excludes script, style and noscript content', () => {
    const h = '<style>.a{}</style><script>var secret = 1;</script><noscript>nojs</noscript><p>shown</p>';
    const t = pageText(h);
    expect(t).toBe('shown');
    expect(quoteOnPage('secret', t)).toBe(false);
  });
  it('finds a quote that straddles tag boundaries', () => {
    const t = pageText('<p>The core is <b>about 3,400</b> <a href="#">km</a> across.</p>');
    expect(quoteOnPage('core is about 3,400 km across', t)).toBe(true);
  });
  it('is case-insensitive and rejects an empty quote', () => {
    expect(quoteOnPage('CORE IS', 'the core is hot')).toBe(true);
    expect(quoteOnPage('', 'anything')).toBe(false);
  });
});

describe('numbers', () => {
  it('handles thousands commas, decimals and whole-number boundaries', () => {
    expect(numbersIn('3.25 and 2,100')).toEqual([3.25, 2100]);
    expect(quoteHasNumber('about 18300 km', 1830)).toBe(false);
    expect(quoteHasNumber('about 1830 km', 1830)).toBe(true);
  });
});

describe('kmIn and percentIn', () => {
  it('reads each range form', () => {
    expect(kmIn('1,650–1,675 km')).toEqual([1650, 1675]);
    expect(kmIn('1650-1675 km')).toEqual([1650, 1675]);
    expect(kmIn('between 1,650 and 1,675 km')).toEqual([1650, 1675]);
    expect(kmIn('1650 to 1675 kilometers')).toEqual([1650, 1675]);
    expect(kmIn('1650 to 1675 kilometres')).toEqual([1650, 1675]);
  });
  it('accepts attached and spaced units, decimals, and ignores speeds and miles', () => {
    expect(kmIn('1737.4km')).toEqual([1737.4]);
    expect(kmIn('about 2,100 miles (3,400 km)')).toEqual([3400]);
    expect(kmIn('2,100 miles to 3,400 km')).toEqual([3400]);
    expect(kmIn('moving 5 km/s over 40 km')).toEqual([40]);
  });
  it('reads percentages the same way', () => {
    expect(percentIn('about 55% of the radius')).toEqual([55]);
    expect(percentIn('from 20 to 25 percent of the radius')).toEqual([20, 25]);
    expect(percentIn('55 km and 30 %')).toEqual([30]);
    expect(quoteHasPercent('about 55% of the radius', 55)).toBe(true);
    expect(quoteHasPercent('about 55% of the radius', 5)).toBe(false);
  });
});

const Y = { yearOnly: true };

describe('quoteHasDate formats', () => {
  it.each([
    'It launched on November 28, 1964.',
    'It launched on Nov. 28, 1964.',
    'It launched on Nov 28, 1964.',
    'It launched on 28 November 1964.',
    'It launched on 1964-11-28.',
    'It launched on November 28th, 1964.',
    'It launched on Nov. 28 1964.',
  ])('finds 1964-11-28 in %s', (q) => {
    expect(quoteHasDate([q], '1964-11-28')).toBe(true);
  });
  it('handles abbreviations and ordinals', () => {
    expect(quoteHasDate(['on Sept. 5, 1977'], '1977-09-05')).toBe(true);
    expect(quoteHasDate(['on Sep 5, 1977'], '1977-09-05')).toBe(true);
    expect(quoteHasDate(['on Jan. 3, 2004'], '2004-01-03')).toBe(true);
    expect(quoteHasDate(['on Feb. 3, 2004'], '2004-02-03')).toBe(true);
    expect(quoteHasDate(['on Aug. 20, 1975'], '1975-08-20')).toBe(true);
    expect(quoteHasDate(['on July 14th, 1965'], '1965-07-14')).toBe(true);
    expect(quoteHasDate(['on 1st June 1990'], '1990-06-01')).toBe(true);
  });
  it('does not confuse months, days or years', () => {
    expect(quoteHasDate(['on Nov. 28, 1964'], '1964-12-28')).toBe(false);
    expect(quoteHasDate(['on Nov. 28, 1964'], '1964-11-29')).toBe(false);
    expect(quoteHasDate(['on Nov. 28, 1964'], '1965-11-28')).toBe(false);
    expect(quoteHasDate(['on Nov. 128, 1964'], '1964-11-28')).toBe(false);
    expect(quoteHasDate(['on Nov. 28, 19640'], '1964-11-28')).toBe(false);
    expect(quoteHasDate([], '1964-11-28')).toBe(false);
  });
  it('applies the year-only rule only to dates ending -01-01', () => {
    expect(quoteHasDate(['planned for launch in 2028'], '2028-01-01')).toBe(false); // day-level by default
    expect(quoteHasDate(['planned for launch in 2028'], '2028-01-01', Y)).toBe(true);
    expect(quoteHasDate(['planned for launch in 2028'], '2028-03-01', Y)).toBe(false);
    expect(quoteHasDate(['planned for launch in 2028'], '2028-01-02', Y)).toBe(false);
    expect(quoteHasDate(['launched January 2, 2028'], '2028-01-01', Y)).toBe(false);
    expect(quoteHasDate(['launched January 1, 2028'], '2028-01-01', Y)).toBe(true);
    expect(quoteHasDate(['planned for launch in 2029'], '2028-01-01', Y)).toBe(false);
  });
});

describe('verify messages', () => {
  const src = [{ id: 'p', title: 't', publisher: 'NASA', url: 'https://science.nasa.gov/mars', license: 'l' }];
  const layer = (over: Record<string, unknown>) => ({
    id: 'l', name: 'L', from: 'radius' as const,
    outer: { min: 10, max: 10, sourceId: 'p', quote: 'the inner layer radius is 10 km' },
    inner: { min: 0, max: 0, sourceId: 'p', quote: 'the inner layer radius is 10 km' },
    state: 'solid' as const, composition: null, uncertain: false, ...over,
  });
  it('reports unregistered sources, missing pages, quotes off the page and bad composition', () => {
    const pages = new Map([['p', 'the inner layer radius is 10 km and more']]);
    const bad = layer({
      outer: { min: 10, max: 10, sourceId: 'zzz', quote: 'the inner layer radius is 10 km' },
      inner: { min: 0, max: 0, sourceId: 'p', quote: 'this sentence is not on the page' },
      composition: { sourceId: 'p', quote: 'mostly iron and nickel in the core', text: 'iron' },
    });
    const out = verifyInteriors({ sources: src, bodies: { x: { layers: [bad] } } }, pages).join('\n');
    expect(out).toMatch(/zzz is not registered/);
    expect(out).toMatch(/inner: quote not on page/);
    expect(out).toMatch(/composition: quote not on page/);
    expect(verifyInteriors({ sources: src, bodies: { x: { layers: [layer({})] } } }, new Map()).join()).toMatch(/no page text/);
  });
  it('checks percent layers as percentages and exempts zero', () => {
    const pages = new Map([['p', 'the core is 55% of the radius']]);
    const q = 'the core is 55% of the radius';
    const ok = layer({ from: 'percent', outer: { min: 55, max: 55, sourceId: 'p', quote: q }, inner: { min: 0, max: 0, sourceId: 'p', quote: q } });
    expect(verifyInteriors({ sources: src, bodies: { x: { layers: [ok] } } }, pages)).toEqual([]);
    const bad = layer({ from: 'percent', outer: { min: 56, max: 55, sourceId: 'p', quote: q }, inner: { min: 0, max: 0, sourceId: 'p', quote: q } });
    expect(verifyInteriors({ sources: src, bodies: { x: { layers: [bad] } } }, pages).join()).toMatch(/56 percent not in quote/);
  });
  it('checks discovery dates and mission launch dates', () => {
    const pages = new Map([['p', 'Found by Galileo on January 7, 1610. The probe is planned for launch in 2028.']]);
    const file = {
      sources: src,
      bodies: {
        jupiter: {
          discovery: { kind: 'discovered' as const, sourceId: 'p', quote: 'Found by Galileo on January 7, 1610', by: 'Galileo', date: '1610-01-08', method: 'telescope' },
          missions: [{ id: 'm', name: 'M', agency: 'NASA', type: 'probe' as const, launchDate: '2028-01-01', arrivalDate: null, endDate: null, outcome: 'planned' as const, sourceId: 'p', quotes: ['The probe is planned for launch in 2028.'] }],
        },
      },
    };
    const out = verifyMissions(file, pages);
    expect(out.join()).toMatch(/discovery: date 1610-01-08 not in quote/);
    expect(out).toHaveLength(1);
  });
});

describe('false-pass guards', () => {
  it('does not read a mission number as the day', () => {
    expect(quoteHasDate(['Voyager 2 August 1977 was launched'], '1977-08-02')).toBe(false);
    expect(quoteHasDate(['Apollo 11 July 1969'], '1969-07-11')).toBe(false);
    expect(quoteHasDate(['Pioneer 10 March 1972'], '1972-03-10')).toBe(false);
    expect(quoteHasDate(['launched on 20 August 1977'], '1977-08-20')).toBe(true);
    expect(quoteHasDate(['Voyager 2 launched (20 August 1977)'], '1977-08-20')).toBe(true);
    expect(quoteHasDate(['On 20 August 1977, Voyager 2 launched'], '1977-08-20')).toBe(true);
    expect(quoteHasDate(['Voyager 2 20 August 1977'], '1977-08-20')).toBe(true);
  });
  it('does not count km squared, cubed or to a power as kilometres', () => {
    expect(kmIn('area 3,400 km² and 12 km^3 and 5 km³ and 4 km⁴')).toEqual([]);
    expect(kmIn('area 3,400 km² over 12 km')).toEqual([12]);
  });
  it('does not let a range leak into an unrelated leading number', () => {
    expect(kmIn('Apollo 11 - 3,400 km')).toEqual([3400]);
    expect(kmIn('Mars 4 and 3,400 km')).toEqual([3400]);
    expect(kmIn('Mars 4 to 3,400 km')).toEqual([3400]);
    expect(kmIn('from 1,650 to 1,675 km')).toEqual([1650, 1675]);
    expect(kmIn('a radius of 1,650-1,675 km')).toEqual([1650, 1675]);
    expect(kmIn('1,650 and 1,675 km')).toEqual([1675]);
  });
  it('restricts the year-only rule to a bare year', () => {
    expect(quoteHasDate(['launched in July 1965'], '1965-01-01', Y)).toBe(false);
    expect(quoteHasDate(['launched in 1965 July'], '1965-01-01', Y)).toBe(false);
    expect(quoteHasDate(['launch is set for 2028'], '2028-01-01', Y)).toBe(true);
  });
  it('allows the year-only rule only for the launch date of a planned mission', () => {
    const base = { id: 'm', name: 'M', agency: 'NASA', type: 'probe' as const, arrivalDate: null, endDate: null, sourceId: 'p' };
    const q = 'The probe is planned for launch in 2028 and more';
    const pages = new Map([['p', q]]);
    const src = [{ id: 'p', title: 't', publisher: 'NASA', url: 'https://science.nasa.gov/x', license: 'l' }];
    const run = (m: object) => verifyMissions({ sources: src, bodies: { x: { discovery: null, missions: [{ ...base, launchDate: '2028-01-01', outcome: 'planned' as const, quotes: [q], ...m }] } } }, pages);
    expect(run({})).toEqual([]);
    expect(run({ outcome: 'success' }).join()).toMatch(/launch 2028-01-01 not in any quote/);
    expect(run({ arrivalDate: '2028-01-01' }).join()).toMatch(/arrival 2028-01-01 not in any quote/);
  });
});

describe('source and quote gates', () => {
  const quote = 'the inner layer radius is 10 km across';
  const layerFile = (url: string, extra: Partial<CuratedSource>[] = []) => ({
    sources: [{ id: 'p', title: 't', publisher: 'p', url, license: 'l' }, ...extra.map((e) => ({ id: 'q', title: 't', publisher: 'p', url, license: 'l', ...e }))],
    bodies: { x: { layers: [{ id: 'l', name: 'L', from: 'radius' as const, outer: { min: 10, max: 10, sourceId: 'p', quote }, inner: { min: 0, max: 0, sourceId: 'p', quote }, state: 'solid' as const, composition: null as { sourceId: string; quote: string; text: string } | null, uncertain: false }] } },
  });
  const pages = new Map([['p', quote]]);
  it.each(['https://science.nasa.gov/a', 'https://nssdc.gsfc.nasa.gov/b', 'https://planetarynames.wr.usgs.gov/c', 'https://nasa.gov/d'])('accepts %s', (url) => {
    expect(verifyInteriors(layerFile(url), pages)).toEqual([]);
  });
  it.each([
    ['https://en.wikipedia.org/wiki/Mars', 'en.wikipedia.org'],
    ['https://notnasa.gov.evil.com/x', 'notnasa.gov.evil.com'],
    ['https://evilnasa.gov/x', 'evilnasa.gov'],
  ])('rejects %s', (url, host) => {
    expect(verifyInteriors(layerFile(url), pages).join()).toContain('source p is not on an official host: ' + host);
  });
  it('lists the official hosts', () => {
    expect(OFFICIAL_HOSTS).toContain('esa.int');
  });
  it('reports duplicate source ids', () => {
    expect(verifyInteriors(layerFile('https://science.nasa.gov/a', [{ id: 'p' }]), pages).join()).toMatch(/duplicate source id p/);
  });
  it('reports quotes shorter than six words, including composition and discovery', () => {
    const f = layerFile('https://science.nasa.gov/a');
    f.bodies.x.layers[0]!.outer.quote = 'core 10 km';
    f.bodies.x.layers[0]!.composition = { sourceId: 'p', quote: 'the inner', text: 'x' };
    const out = verifyInteriors(f, new Map([['p', quote + ' core 10 km the inner']])).join('\n');
    expect(out).toMatch(/outer: quote too short \(3 words\)/);
    expect(out).toMatch(/composition: quote too short \(2 words\)/);
    const m = verifyMissions({ sources: f.sources, bodies: { x: { discovery: { kind: 'antiquity', sourceId: 'p', quote: 'the inner' }, missions: [] } } }, new Map([['p', 'the inner']]));
    expect(m.join()).toMatch(/discovery: quote too short \(2 words\)/);
  });
});
