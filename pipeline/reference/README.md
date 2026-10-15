# Curated references

Some detail values (interior layers, missions, discovery) cannot be parsed from a table. They are curated by hand from NASA pages and stored in this folder. Every value carries the exact sentence it came from, and the build checks that sentence against the fetched page.

Types and checks live in `pipeline/sources/quotedReference.ts`.

## Files

- `interiors.json` is an `InteriorsFile`: `sources` plus `bodies[bodyId].layers`.
- `missions.json` is a `MissionsFile`: `sources` plus `bodies[bodyId] = { discovery, missions }`.

Each `sources` entry is `{ id, title, publisher, url, license }`. Every `sourceId` used in the file must be registered there.

## Rules

1. Official sources only. The source URL's host must be, or be a subdomain of, one of: nasa.gov, usgs.gov, esa.int, jaxa.jp, isro.gov.in, cnsa.gov.cn (list: `OFFICIAL_HOSTS`). That covers NSSDCA, NASA science and mission pages, and the USGS Gazetteer. No Wikipedia, no aggregators, no blogs. Source ids must be unique. If NASA does not state a value, do not record it.
2. Every recorded number needs a quote: the sentence, copied exactly from the page. Curly quotes, en/em dashes, non-breaking spaces, HTML entities and case do not matter; any other difference does. A quote must be at least 6 words long (composition and discovery quotes too); a bare phrase is not evidence.
3. Every recorded number must appear in its own quote. Check what the sentence actually says rather than what you remember.
4. Kilometres, not miles. Interior radii and depths are checked as kilometres (a number followed by `km`, `kilometer(s)` or `kilometre(s)`), or as percent for `from: 'percent'`. A range counts for its first number when the second carries the unit: `1,650-1,675 km`, `between 1,650 and 1,675 km`, `1650 to 1675 kilometers`. The range is read only when it is clearly one: a dash needs the first number not to follow a name or hyphen (so `Apollo 11 - 3,400 km` gives only 3400); `and` needs `between` before it; `to` needs `from` or `between` before it, or a first number that does not follow a name. Table rows count too: numbers directly after a `(km)` label (whitespace and `*` footnote marks only between them) are kilometres, so `Core radius (km) 3485` gives 3485 and `Core radius (km) 1830 ** 3485` gives both; a number after other words does not count. Use a quote with at least 6 words (for example include the row above it). Squared and cubed units (`km²`, `km^3`) and `km/s` are not kilometres.
5. The miles-first trap: in "a core about 2,100 miles (3,400 km) wide", 3400 passes and 2100 fails. Record 3400. Quote the sentence that has the kilometre figure; if the page gives only miles, the value cannot be recorded.
6. Radii versus diameters: the page often gives a diameter. Do not halve it yourself. Record a value only if a number in the quote is the radius or depth you store, or quote a different sentence that states it.
7. Dates are ISO (`YYYY-MM-DD`) in the data and must appear in a quote as a day-level date: `November 28, 1964`, `Nov. 28, 1964`, `28 November 1964`, `1964-11-28` (ordinal days such as `July 14th, 1965` also work). A number that follows a name is not a day: `Voyager 2 August 1977` does not state 2 August. Month and year alone (`July 1965`) never matches. One exception: the launch date of a mission whose outcome is `planned` and which the source gives only as a year is stored as `YYYY-01-01`; it matches on the bare year, provided no month sits beside that year in the quote. Arrival, end and discovery dates always need a day.
8. A value of 0 needs no quote number: a depth of 0 at the surface, or an inner radius of 0 at the centre.

## Layers

`from` says what the numbers mean: `radius` (km from the centre), `depth` (km below the surface) or `percent` (percent of the body's radius, from the centre). Write the outermost layer with `from: 'depth'` and outer depth 0; the build converts depths to radii using the body's cited mean radius. A bound may carry its own `from` (`radius`, `depth` or `percent`) that overrides the layer's for that bound, for example a mantle whose outer bound is a depth and whose inner bound is a core radius; the layer-level `from` is then the outer bound's. Consecutive layers may differ at their shared boundary by up to max(40 km, 0.5% of the body radius). Set `uncertain: true` for layers the source hedges. `composition` is `null` or `{ sourceId, quote, text }`, where the quote is on the page.

## Adding an entry

1. Find the NASA page. Add it to the file's `sources` if it is not there (stable URL, publisher, license).
2. Make sure its HTML is in the page cache, then copy the sentence verbatim.
3. Add the layer or mission with its numbers and dates. Mission `quotes` must together contain the launch date and, when set, the arrival and end dates.
4. Run the check (below) and fix everything it reports.

## Running the check

The build step that loads these files (added with the details builder) calls `verifyInteriors` and `verifyMissions` with the cached page text, so `npm run data:offline` fails on any problem. Until then, run the unit tests with `npx vitest run pipeline/sources/quotedReference.test.ts`.

`verifyInteriors` and `verifyMissions` return a list of problems, one string each, for example:

- `mars/core outer.min: 2100 km not in quote: "..."`
- `mars/mariner-4: arrival 1965-07-15 not in any quote`
- `quote not on page of <sourceId>`, `quote too short (3 words)`, `source <sourceId> is not registered`, `source <id> is not on an official host: <host>`, `duplicate source id <id>`

An empty list means every quote is on its page and every number and date is in its quote. The build fails otherwise.
