---
title: 0010 Names databases for Earth positions
tags: [decision]
---

# 0010 Names databases for Earth positions

Back to [[Home]] · Spec: [[2026-11-15-m2b4a-feature-pins-design]] §6.2 · Plan: [[2026-11-15-m2b4a-feature-pins]] Tasks 5, 12 and 13 · Date: 2026-11-15 · Status: accepted; widened 2026-11-16 (second and third decisions below)

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

**What counts as an official position source** (controller ruling; **accepted by the user on 2026-11-16: "use the new sources"**, which covers NOAA NCEI, GEBCO, Natural Resources Canada and LINZ):
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
| `ga-cga` | Geoscience Australia, Composite Gazetteer of Australia (third decision, below) | Australia only | ga.gov.au |
| `gns` | NGA GEOnet Names Server | not in use (unreachable) | nga.mil |

Rules added with the registry:
- Each source's cited page must be on that source's own host. `POSITION_HOSTS` is the official hosts plus the registry's hosts; the extra hosts are never accepted for a quoted sentence.
- The type is the record's own class: GNIS `feature_class`, NOAA `morphology`, GEBCO generic term, NRCan concise code term, LINZ `feat_type`.
- A national source is checked against the record's own territory: an NRCan record must carry a province or territory code (codes 72 "Undersea Feature" and 73 "International Waters" fail); a LINZ record must name a New Zealand land district (Ross Dependency and undersea records have none and fail). The build fails otherwise.
- `gns` stays defined but unusable, with its reason, so it can be switched on later.

## Third decision: Australia (2026-11-16)
**The user (2026-11-16): "keep australia".**

**The controller's reading (a reading, not the user's words):** cover Australia by accepting Geoscience Australia's general site licence for the Composite Gazetteer of Australia, and record that the dataset's own entries state no licence.
- Geoscience Australia's copyright page (https://www.ga.gov.au/copyright): "All material on this website is licensed under the Creative Commons Attribution 4.0 International Licence", with exceptions that include "content the copyright in which belongs to third parties".
- The dataset's catalogue record (ecat.ga.gov.au, reachable on 2026-11-19) gives the use constraint as a licence with the text "© Commonwealth of Australia (Geoscience Australia) 2025" and names no licence. data.gov.au lists the dataset as "notspecified".

**What it is used for:** positions of Australian landmarks, and nothing else. The registry entry is `ga-cga` (source id `ga-composite-gazetteer`, host `ga.gov.au`). It is a national source: a record counts only when its own `authority` field is one of the six states or two mainland territories (NSW, VIC, QLD, SA, WA, TAS, NT, ACT). Records from the Australian Antarctic Division (`AAD`) and the Australian Hydrographic Office (`AHO`) fail the build. The type is the record's `feature` field in sentence case ("MOUNTAIN" → "Mountain").

## Consequences
- Earth first got 21 landmarks, every position from GNIS. **With the second decision it has 43:** the 21 from GNIS, 12 volcanoes from NOAA NCEI, 4 undersea features from GEBCO, 4 Canadian places from NRCan and 2 New Zealand places from LINZ. Every continent and the Atlantic and Pacific Oceans now have landmarks.
- **With the third decision it has 49:** six Australian places from the Composite Gazetteer (Uluru, Kati Thanda-Lake Eyre, Shark Bay, K'gari, Wolfe Creek Crater, Gosses Bluff).
- **Not covered:** wide or famous places with no reachable official point record: the Himalaya and Mount Everest, the Sahara, the Amazon, the Nile, the Great Barrier Reef (the Composite Gazetteer has no record for it).
- **GNS could not be used.** `geonames.nga.mil` timed out from this machine and from the web fetch tool for the whole build (2026-11-15, retries every 4 to 5 minutes). Nothing on its site could be read, so its record format and licence were never confirmed. GNS records are rejected by the check ("the GEOnet Names Server is not in use") until it can be reached and researched.
- **Before the second decision, Earth's landmarks leaned to the United States and Antarctica.** No non-US landmark outside Antarctica had a usable position: every NASA statement of a position found for one was the centre or frame of an image (for example "Location: 3 degrees South latitude, 37 degrees East longitude" for a Kilimanjaro view), not the place itself. Those were not used. See [[Earth names databases (GNIS, GNS)]].
- **GNIS has no fetch of one record by id** that returns the record itself. Its per-state staged text files are about 1 to 3 MB zipped, so the pipeline fetches one file per state used (and one for Antarctica) into `pipeline/raw/`.
- Revisit when GNS can be reached: add its fetch and parser and a fixture, and switch its registry entry on. GNS would cover the places listed above as not covered.
