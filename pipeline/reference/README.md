# Curated references

Some detail values (interior layers, missions, discovery) cannot be parsed from a table. They are curated by hand from NASA pages and stored in this folder. Every value carries the exact sentence it came from, and the build checks that sentence against the fetched page.

Types and checks live in `pipeline/sources/quotedReference.ts`.

## Files

- `interiors.json` is an `InteriorsFile`: `sources` plus `bodies[bodyId].layers`. A body may also carry `magneticField: { sourceId, quote, text }` (used for the Moon, whose Planetary Fact Sheet row says only "No"): a sentence from a registered page, shown in the Magnetic field section. The build checks the quote like any other; without it the field comes from the catalogue fact or the fact sheet. An empty `layers` array means no interior is shown.
- `missions.json` is a `MissionsFile`: `sources` plus `bodies[bodyId] = { discovery, missions }`.

- `landmarks.json` is a `LandmarksFile`: `sources`, `types` and `bodies[bodyId]` (see Landmarks).

Each `sources` entry is `{ id, title, publisher, url, license }` (a paper adds more; see Research papers). Every `sourceId` used in the file must be registered there.

## Rules

1. Official sources only. The source URL's host must be, or be a subdomain of, one of: nasa.gov, usgs.gov, esa.int, jaxa.jp, isro.gov.in, cnsa.gov.cn (list: `OFFICIAL_HOSTS`). That covers NSSDCA, NASA science and mission pages, and the USGS Gazetteer. No Wikipedia, no aggregators, no blogs. Source ids must be unique. If NASA does not state a value, do not record it, except for the paper rule in "Research papers" below.
2. Every recorded number needs a quote: the sentence, copied exactly from the page. Curly quotes, en/em dashes, non-breaking spaces, HTML entities and case do not matter; any other difference does. A quote must be at least 6 words long (composition and discovery quotes too); a bare phrase is not evidence.
3. Every recorded number must appear in its own quote. Check what the sentence actually says rather than what you remember.
4. Kilometres, not miles. Interior radii and depths are checked as kilometres (a number followed by `km`, `kilometer(s)` or `kilometre(s)`), or as percent for `from: 'percent'`. A range counts for its first number when the second carries the unit: `1,650-1,675 km`, `between 1,650 and 1,675 km`, `1650 to 1675 kilometers`. The range is read only when it is clearly one: a dash needs the first number not to follow a name or hyphen (so `Apollo 11 - 3,400 km` gives only 3400); `and` needs `between` before it; `to` needs `from` or `between` before it, or a first number that does not follow a name. Table rows count too: numbers directly after a `(km)` label (whitespace and `*` footnote marks only between them) are kilometres, so `Core radius (km) 3485` gives 3485 and `Core radius (km) 1830 ** 3485` gives both; a number after other words does not count. Use a quote with at least 6 words (for example include the row above it). Squared and cubed units (`km²`, `km^3`) and `km/s` are not kilometres.
5. The miles-first trap: in "a core about 2,100 miles (3,400 km) wide", 3400 passes and 2100 fails. Record 3400. Quote the sentence that has the kilometre figure; if the page gives only miles, the value cannot be recorded.
6. Radii versus diameters: the page often gives a diameter. Do not halve it yourself. Record a value only if a number in the quote is the radius or depth you store, or quote a different sentence that states it.
7. Dates are ISO (`YYYY-MM-DD`) in the data and must appear in a quote as a day-level date: `November 28, 1964`, `Nov. 28, 1964`, `28 November 1964`, `1964-11-28` (ordinal days such as `July 14th, 1965` also work). A number that follows a name is not a day: `Voyager 2 August 1977` does not state 2 August. Month and year alone (`July 1965`) never matches. One exception: the launch date of a mission whose outcome is `planned` and which the source gives only as a year is stored as `YYYY-01-01`; it matches on the bare year, provided no month sits beside that year in the quote. Arrival, end and discovery dates always need a day.
8. A value of 0 needs no quote number: a depth of 0 at the surface, or an inner radius of 0 at the centre.

## Lines that read like a name

A day-first date after "Name N - " (for example `Chang'e 4 - 7 December 2018` on the NSSDCA lunar timeline) reads to the date check as part of the name. List the full line as one quote and the part from the date on (`7 December 2018 - CNSA (China) Lunar Farside Lander and Rover`) as a second quote; both are on the page.

## Layers

`from` says what the numbers mean: `radius` (km from the centre), `depth` (km below the surface) or `percent` (percent of the body's radius, from the centre). Write the outermost layer with `from: 'depth'` and outer depth 0; the build converts depths to radii using the body's cited mean radius. A bound may carry its own `from` (`radius`, `depth` or `percent`) that overrides the layer's for that bound, for example a mantle whose outer bound is a depth and whose inner bound is a core radius; the layer-level `from` is then the outer bound's. Consecutive layers may differ at their shared boundary by up to max(40 km, 0.5% of the body radius). Set `uncertain: true` for layers the source hedges. `sizeKind` and `estimate` are optional (see Research papers). `composition` is `null` or `{ sourceId, quote, text }`, where the quote is on the page. A layer may also carry `stateSource` (`{ sourceId, quote }`, a sentence on a registered page that states the layer's state); the state is then shown with that citation, and without it the state is shown uncited. The drawer prints each bound in its own `from` with the numbers as written here, so a layer stated as 25 percent shows "25 %", never a derived kilometre figure.

A layer may carry `gradual: { sourceId, quote }`: a sentence that says the layer's outer boundary has no sharp edge (a dilute or diffuse core). The build checks it like any quote (on the page, at least 6 words), and the quote must contain one of `GRADUAL_WORDS` (gradual, dilute, diffuse, fuzzy, no clear separation, no sharp). The outermost layer may not carry it: its outer edge is the surface. The built layer keeps only `gradual: { sourceId }`, and the cutaway draws that boundary as an illustrative soft band with no line (the layer card says so). Jupiter's dilute core and Saturn's diffuse core use it.

The build also writes `interior.radiusKm` (`{ value, sourceId }`): the mean radius it converted depth and percent bounds with (the planet's fact sheet; the catalogue's cited radius for the Sun and the Moon). The depth ruler in Explore uses it for the centre and for depths it derives from radius or percent bounds.

## Research papers

Where no official source gives a number (the interiors of Venus and the giant planets), a value may come from a peer-reviewed paper. The decision and reasons are in `Space_visualizer/Decisions/0009-peer-reviewed-papers-for-estimates.md`.

1. Order of preference: an official source with a number, then an official source that names the layer plus a paper for its size, then a paper alone.
2. A paper source is `{ id, title, publisher, url, license, kind: "paper", doi, journal, quoteUrl? }`. `doi` is required (`10.xxxx/...`) and `url` must be `https://doi.org/<doi>`. `journal` must be one of `TRUSTED_JOURNALS`, by canonical title (Nature, Science, Nature Astronomy, Journal of Geophysical Research: Planets, Geophysical Research Letters, Icarus, The Planetary Science Journal, Astronomy & Astrophysics, The Astrophysical Journal, Annual Review of Earth and Planetary Sciences, Space Science Reviews) or a known alias (for example `JGR Planets`, `A&A`, `ApJ`, `PSJ`; case does not matter). `publisher` must equal the canonical title. `url` and `quoteUrl` must use https. Use `license: "Peer-reviewed article; quoted under fair use"`. `doi`, `journal` and `quoteUrl` are for paper sources only. They stay in this folder; the registered source in `sources.json` has the usual five fields.
3. The quote check runs on `quoteUrl` when given, else on the DOI page. `quoteUrl` must be an open copy of the same paper on `arxiv.org`, `ncbi.nlm.nih.gov` (PubMed Central) or `ui.adsabs.harvard.edu` (`OPEN_COPY_HOSTS`). It must be the published or accepted version of that paper. The host check cannot prove this, so the curator must. The pipeline fetches that page into the cache as `ref-<sourceId>.html`. If no copy can be fetched, do not use the value.
4. Quotes and numbers follow the same rules as above (exact sentence, at least 6 words, the number in the quote). A fraction of the radius is a `percent` bound; write the paper's own numbers and the build converts them with the cited mean radius, as for any percent bound. A range stays a range (`min` and `max`), and a dilute or gradual transition is a layer whose bound is a range.
5. Any layer that cites a paper source anywhere (a bound, `stateSource`, `composition` or `gradual`) must have `estimate: true`, or the check fails. In addition, a layer with a bound from a paper must have `sizeKind: "estimate"`, and `sizeKind: "estimate"` needs at least one bound from a paper (so a layer with an official size and only a paper state or composition has `estimate: true` and no `sizeKind`).
6. Illustrative size: if no acceptable number is found, write the layer with `sizeKind: "illustrative"` and no `outer` or `inner`. Layers in a run without bounds share the room evenly between the cited layer above and the cited layer below (the whole radius if none, so an interior of only illustrative layers is allowed). The check fails an illustrative layer with no room between its neighbours. It shows no number.
7. Do not use a preprint that was never published, a press release, an encyclopaedia or an aggregator.

### Documented exceptions

Shah et al. 2022 (Venus core): the quoted sentence says "core size 2930-4350 km", not "core radius". The paper's body, Fig. 8 and its "Core radius" table use the same values as a radius, and a diameter that large is impossible for Venus (mean radius 6,051.8 km), so the layer records it as a radius.

## Landmarks

`landmarks.json` curates the well-known named surface features that Explore draws as pins. Types and checks live in `pipeline/sources/landmarks.ts`. The general rules above apply (official hosts, exact sentences of at least 6 words, kilometres).

```
{ "sources": [ ... ],
  "types":  { "<Gazetteer type>": { "meaning", "sourceId", "quote" } },
  "bodies": { "<bodyId>": [ landmark, ... ] } }          // rank order: the order is the order shown
```

- A Gazetteer body (Mercury, Venus, the Moon, Mars) lists `{ name, sourceId, quote }`. The name must be an approved Gazetteer feature (exact, case-sensitive, the Gazetteer's clean name). Position, size, type, origin and approval year all come from the Gazetteer row, whatever its size (the 200-feature cut does not apply). The build fails on a name that is not there.
- Any other body (Earth) lists `{ name, sourceId, quote, position, size? }`, plus `type` only for a quoted position. `position` is a names-database record (`{ kind: "names-database", database: "gnis", recordId, area }`, read by the build from the fetched record) or numbers stated in a sentence (`{ kind: "quoted", latDeg, lonDegE, sourceId, quote }`). An optional `size` is `{ km, sourceId, quote }` and the km figure must be in the quote. A names-database landmark carries no `type`: the build takes it from the record's own `feature_class` (for example "Valley") and cites it to the names database; an empty class is a build error, and a `type` on such an entry fails the check. A quoted-position landmark has a curated plain-word `type` ("Volcano"), shown without a source number. Earth types get no entry in `types`.
- `types` give the meaning of a Gazetteer feature type, from the Gazetteer's descriptor-terms page. The quote must contain the type and the meaning. A body's details carry only the meanings of the types it uses.

Rules:

1. Two things per landmark: a sentence worth showing (an official page that says something about the feature) and an official position. The sentence never supplies the position unless it states it as numbers.
2. Positions are never read off a map or typed from memory. Each one is the Gazetteer's, a names-database record's, or numbers stated in a quoted sentence. For a quoted position the build runs `parseStatedPosition` on the quote (two numbers, each with a hemisphere letter or word, or a sign after the word latitude or longitude; degrees with optional minutes) and the stored latitude and longitude must equal what it reads. Longitudes are stored 0 to 360 east, so 112.1 W is 247.9.
3. No research papers. A `kind: "paper"` source fails the check ("papers are not allowed for landmarks"). The names databases (GNIS, GNS) are position sources only and are never quoted.
4. A landmark name is unique within its body.

### Earth positions from a names database

Decision: `Space_visualizer/Decisions/0010-names-databases-for-earth-positions.md`. Code: `pipeline/sources/namesDatabase.ts`.

1. Prefer a names-database record; use a quoted position only when no record exists. A position stated for an image (its centre, frame or "Location:" line) is not a position for the place.
2. GNIS covers the United States and Antarctica. `recordId` is the GNIS Feature ID. `area` names the staged file that holds the record: the two-letter state or territory code (`AZ`, `HI`) or `Antarctica`. The build fetches `DomesticNames_<area>_Text.zip` (or the Antarctica zip) into `pipeline/raw/names-gnis-<area>.zip`, finds the record by id, and uses its primary point (`prim_lat_dec`, `prim_long_dec`).
3. The landmark name must be the record's `feature_name`, or a name the record lists (only the Antarctica file lists other names). Otherwise the build fails with `earth/<name>: record <id> is named <other>`. When it matched a listed name, the position text adds `(GNIS name: <record name>)`.
4. To find a record, search the state file by name and check the class, state and county (many places share a name: there are dozens of "Crater Lake" records). For a stream or a valley the primary point is the mouth.
5. The record's source must be on a position host: `POSITION_HOSTS` is the official hosts plus `nga.mil`. `nga.mil` is never accepted for a quoted sentence.
6. The NGA GEOnet Names Server (`database: "gns"`) is not in use: it could not be reached when Earth's landmarks were built, so a `gns` position fails the check. See `Space_visualizer/Data Sources/Earth names databases (GNIS, GNS).md`.

The build checks a landmark's quote like any other, and `npm run data:offline` fails on any problem. The check is `verifyLandmarks`; its messages look like `mars/Olympus Mons: quote not on page of <sourceId>: "..."`.

## Adding an entry

1. Find the NASA page. Add it to the file's `sources` if it is not there (stable URL, publisher, license).
2. Make sure its HTML is in the page cache, then copy the sentence verbatim.
3. Add the layer or mission with its numbers and dates. Mission `quotes` must together contain the launch date and, when set, the arrival and end dates.
4. Run the check (below) and fix everything it reports.

## Running the check

The build step that loads these files (added with the details builder) calls `verifyInteriors` and `verifyMissions` with the cached page text, so `npm run data:offline` fails on any problem. Until then, run the unit tests with `npx vitest run pipeline/sources/quotedReference.test.ts`.

`verifyInteriors` and `verifyMissions` return a list of problems, one string each, for example:

- `mars/core outer.min: 2100 km not in quote: "..."`
- `mars/mariner-4: arrival 1965-07-14 not in any quote`
- `quote not on page of <sourceId>`, `quote too short (3 words)`, `source <sourceId> is not registered`, `source <id> is not on an official host: <host>`, `duplicate source id <id>`

An empty list means every quote is on its page and every number and date is in its quote. The build fails otherwise.

## Time zones in mission dates

Mission dates follow the cited page's own convention, which is US local time on some NASA pages and UT on others. Prefer the UT date only when the page states the UT date with its year in a form the date check accepts; otherwise record the page's main date (often US local time) and keep the quote that states it. Example of the otherwise case: the Mariner 4 page gives the flyby as July 14, 1965 (EDT) and the UT form only as "[01:00:57 UT July 15]", without a year, so the arrival is recorded as 1965-07-14 (UT was July 15). Do not convert dates yourself: the recorded date must appear in the quote.
