---
title: 0010 Names databases for Earth positions
tags: [decision]
---

# 0010 Names databases for Earth positions

Back to [[Home]] · Spec: [[2026-11-15-m2b4a-feature-pins-design]] §6.2 · Plan: [[2026-11-15-m2b4a-feature-pins]] Task 5 · Date: 2026-11-15 · Status: accepted

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

## Consequences
- Earth gets 21 landmarks, every position from GNIS.
- **GNS could not be used.** `geonames.nga.mil` timed out from this machine and from the web fetch tool for the whole build (2026-11-15, retries every 4 to 5 minutes). Nothing on its site could be read, so its record format and licence were never confirmed. GNS records are rejected by the check ("the GEOnet Names Server is not in use") until it can be reached and researched.
- **Earth's landmarks lean to the United States and Antarctica.** No non-US landmark outside Antarctica has a usable position: every NASA statement of a position found for one was the centre or frame of an image (for example "Location: 3 degrees South latitude, 37 degrees East longitude" for a Kilimanjaro view), not the place itself. Those were not used. See [[Earth names databases (GNIS, GNS)]].
- **GNIS has no fetch of one record by id** that returns the record itself. Its per-state staged text files are about 1 to 3 MB zipped, so the pipeline fetches one file per state used (and one for Antarctica) into `pipeline/raw/`.
- Revisit when GNS can be reached: add its fetch and parser, a fixture, and the non-US landmarks.
