---
title: 0010 Names databases for Earth positions
tags: [decision]
---

# 0010 Names databases for Earth positions

Back to [[Home]] · Spec: [[2026-11-15-m2b4a-feature-pins-design]] §6.2 · Plan: [[2026-11-15-m2b4a-feature-pins]] Tasks 5 and 12 · Date: 2026-11-15 · Status: accepted; widened 2026-11-16 (second decision below)

## Context
Explore draws landmark pins on each body. For Mercury, Venus, the Moon and Mars, the USGS Gazetteer of Planetary Nomenclature gives every landmark's position. The Gazetteer has no Earth entries. An Earth pin still needs an official position. NASA, USGS and ESA pages describe famous places well, but they rarely state a latitude and longitude for them.

## Options
1. **A. Quoted sentence only.** A position counts only when a NASA, USGS or ESA sentence states it. Few pages do, so Earth would get very few pins.
2. **B. An official names database, then a quoted sentence.** The U.S. Board on Geographic Names data gives one point per named place: USGS GNIS for the United States and Antarctica, the NGA GEOnet Names Server (GNS) for the rest of the world. A quoted sentence is the second choice.

## Decision
**Option B** (the user, 2026-11-15). The source rule is amended for one use only: the position of an Earth landmark.

Rules, as built in `pipeline/sources/namesDatabase.ts` and `pipeline/sources/landmarks.ts`:
- **What a names database may give:** a position, and nothing else. The NGA host (`nga.mil`) is in `POSITION_HOSTS` (the official hosts plus `nga.mil`). It is never in `OFFICIAL_HOSTS`, so a quoted sentence on an NGA page fails the check.
- **The sentence on the card** always comes from NASA, USGS or ESA, quote-checked like every other landmark sentence.
- **How a record is checked:** the landmark stores the record's id (`recordId`), and for GNIS the staged file that holds it (`area`: a two-letter state code or `Antarctica`). The build fetches that file, finds the record by id, and reads its primary point (`prim_lat_dec`, `prim_long_dec`, NAD83). The landmark's name must be the record's name or a name the record lists for it. Otherwise the build fails with `earth/<name>: record <id> is named <other>`. A record not found is a build error, never a skipped pin. The record's cited source must be on a position host.
- **What the card shows:** the point as the record writes it (for example `36.112764, -113.9960696`), cited to the database. When the landmark matched by another listed name, the text adds the record's own name. A wide place (a river, a range, an ice shelf) has one point in the database; the point is the database's point for the name, not a measured centre. A river's GNIS point is its mouth, and a valley's is its mouth too.
- **Fallback:** a quoted sentence that states the position as numbers (`parseStatedPosition`). A landmark with neither is dropped.

## Second decision: other official sources (2026-11-16)
GNS could not be reached (below), so Earth had landmarks only in the United States and Antarctica. **The user (2026-11-15): "it didn't work use other official sources that have similar data".** This widens Option B: an Earth landmark's position may come from other official sources that hold named places with coordinates.

**What counts as an official position source** (controller ruling, for the user to check):
- A government agency (national mapping, geological, oceanographic or space agency) or an intergovernmental body (UN bodies, IHO-IOC and the like), publishing a names database or dataset in which each record has a name and coordinates.
- Fetchable by the pipeline over HTTPS with no key, login, cookie or browser, through the cached fetchers, so `npm run data:offline` works afterwards.
- Its terms allow use with attribution; the licence text and where it is stated are recorded.
- Not allowed: GeoNames.org, OpenStreetMap, Wikidata, Wikipedia, Natural Earth, commercial map services, or any volunteer or aggregator dataset, even where they copy official data.
- A national source is used only for places in its own country. A worldwide source may be used anywhere.

**Sources now in use** (registry `NAMES_SOURCES` in `pipeline/sources/namesDatabase.ts`; details in [[Earth names databases (GNIS, GNS)]]):

| Database | Publisher | Used for | Cited host |
|---|---|---|---|
| `gnis` | USGS / U.S. Board on Geographic Names | United States and Antarctica | usgs.gov |
| `noaa-volcano` | NOAA NCEI, Volcano Locations Database | volcanoes anywhere | noaa.gov |
| `gebco` | IHO-IOC GEBCO Gazetteer of Undersea Feature Names (served by NOAA NCEI) | undersea features anywhere | gebco.net |
| `nrcan` | Natural Resources Canada, Canadian Geographical Names Database | Canada only | natural-resources.canada.ca |
| `linz` | Toitū Te Whenua LINZ, New Zealand Gazetteer | New Zealand only | linz.govt.nz |
| `gns` | NGA GEOnet Names Server | not in use (unreachable) | nga.mil |

Rules added with the registry:
- Each source's cited page must be on that source's own host. `POSITION_HOSTS` is the official hosts plus the registry's hosts; the extra hosts are never accepted for a quoted sentence.
- The type is the record's own class: GNIS `feature_class`, NOAA `morphology`, GEBCO generic term, NRCan concise code term, LINZ `feat_type`.
- A national source is checked against the record's own territory: an NRCan record must carry a province or territory code (codes 72 "Undersea Feature" and 73 "International Waters" fail); a LINZ record must name a New Zealand land district (Ross Dependency and undersea records have none and fail). The build fails otherwise.
- `gns` stays defined but unusable, with its reason, so it can be switched on later.

## Consequences
- Earth first got 21 landmarks, every position from GNIS. **With the second decision it has 43:** the 21 from GNIS, 12 volcanoes from NOAA NCEI, 4 undersea features from GEBCO, 4 Canadian places from NRCan and 2 New Zealand places from LINZ. Every continent and the Atlantic and Pacific Oceans now have landmarks.
- **Not covered:** Australia (its Composite Gazetteer has no licence stated on any page reachable from here: data.gov.au says "notspecified"), and wide or famous places with no reachable official point record: the Himalaya and Mount Everest, the Sahara, the Amazon, the Nile, the Great Barrier Reef.
- **GNS could not be used.** `geonames.nga.mil` timed out from this machine and from the web fetch tool for the whole build (2026-11-15, retries every 4 to 5 minutes). Nothing on its site could be read, so its record format and licence were never confirmed. GNS records are rejected by the check ("the GEOnet Names Server is not in use") until it can be reached and researched.
- **Before the second decision, Earth's landmarks leaned to the United States and Antarctica.** No non-US landmark outside Antarctica had a usable position: every NASA statement of a position found for one was the centre or frame of an image (for example "Location: 3 degrees South latitude, 37 degrees East longitude" for a Kilimanjaro view), not the place itself. Those were not used. See [[Earth names databases (GNIS, GNS)]].
- **GNIS has no fetch of one record by id** that returns the record itself. Its per-state staged text files are about 1 to 3 MB zipped, so the pipeline fetches one file per state used (and one for Antarctica) into `pipeline/raw/`.
- Revisit when GNS can be reached: add its fetch and parser and a fixture, and switch its registry entry on. GNS would cover the places listed above as not covered.
