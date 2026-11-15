---
title: Earth names databases (GNIS, GNS)
publisher: U.S. Geological Survey / U.S. Board on Geographic Names (GNIS); National Geospatial-Intelligence Agency (GNS)
url: https://www.usgs.gov/us-board-on-geographic-names/download-gnis-data
used-for: [positions of Earth landmarks]
tags: [data-source]
---

# Earth names databases (GNIS, GNS)

Back to [[Home]] · Rules: [[0010-names-databases-for-earth-positions]] · Built in [[2026-11-15-m2b4a-feature-pins]] Task 5

## GNIS (in use)
- **Publisher:** U.S. Geological Survey, for the U.S. Board on Geographic Names.
- **What it holds:** official names and one primary point for features in the 50 states, DC, Puerto Rico, the U.S. Virgin Islands, Guam, the Northern Mariana Islands, and Antarctica (names approved by the Advisory Committee on Antarctic Names).
- **URL pattern:** `https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/DomesticNames/DomesticNames_<ST>_Text.zip` (one state or territory) and `https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/Antarctica/Gazetteer_Antarctica_Text.zip`. The USGS download page names this bucket as The National Map Staged Products Directory.
- **Citation link:** the source record links the USGS page `https://www.usgs.gov/us-board-on-geographic-names/download-gnis-data`, so a click opens a page instead of a zip.
- **Source id:** `usgs-gnis`.
- **Format:** pipe-delimited UTF-8 text with a header line (a BOM at the start, CRLF line ends). Fields used: `feature_id` (the permanent Feature ID), `feature_name` (the official name), `prim_lat_dec`, `prim_long_dec` (decimal degrees, NAD83). The Antarctica zip also has `AntarcticaAllNames_Antarctica.txt`, which lists other names for a record (for example "Dry Valleys" for "McMurdo Dry Valleys"). Field meanings: `GNIS_file_format.pdf` in the same directory (dated October 2, 2026). A record with `0, 0` has no known location and is rejected.
- **Example record** (DomesticNames_AZ.txt, fetched 2026-11-15): `23907|Grand Canyon|Valley|Arizona|04|Mohave|015|Columbine Falls|06/27/1984|09/05/2019|Official|Board Decision|02/04/1925|360646N|1135946W|36.112764|-113.9960696|365130N|1113603W|36.8583209|-111.6007163`. The landmark's position is 36.112764° N, 246.0039304° E (113.9960696° W).
- **Licence:** public domain. The files' metadata says "Use constraints: None. Acknowledgment of the U.S. Geological Survey would be appreciated for products derived from these data." and "Access constraints: None".
- **Why the staged files and not one record:** the National Map `geonames` map service can be queried by `gaz_id`, but it returns reprojected geometry (it differs from the record in the fifth decimal) and gives a valley two unlabelled points. The record view in the Domestic Names search app needs a browser. A state file is about 1 to 3 MB zipped, under the plan's 50 MB limit.
- **Accuracy / caveats:** one point per name. For a stream or a valley the primary point is the mouth (the map service calls that layer "Streams (Mouth)"), so the Mississippi River's point is in its delta and the Grand Canyon's is at its west end. A lake's point is somewhere on the water. The state files carry no other names; only the Antarctica file does.
- **How it is read:** `pipeline/sources/namesDatabase.ts` (`namesFileUrl`, `findNamesRecord`, `parseNamesRecord`); `pipeline/run.ts` fetches one file per area used. Checks in `verifyLandmarks` (`pipeline/sources/landmarks.ts`).
- **How it is refreshed:** `npm run data` (cache: `pipeline/raw/names-gnis-<area>.zip`); `npm run data:offline` rebuilds from the cache.
- **Test fixtures:** header and record lines cut from the fetched files: `pipeline/fixtures/names-gnis-*.txt`.

## GNS (not in use)
- **Publisher:** National Geospatial-Intelligence Agency (NGA), for the U.S. Board on Geographic Names. Coverage: the world outside the United States and Antarctica.
- **Status:** could not be reached. `geonames.nga.mil` timed out (TCP connect) on every try on 2026-11-15, from this machine and from the web fetch tool, from 09:55 to 10:30 UTC. `www.nga.mil` answered normally. The ArcGIS query form seen in search results was `https://geonames.nga.mil/geon-ags/rest/services/RESEARCH/GIS_OUTPUT/MapServer/0/query?where=ufi+%3D+<UFI>&outFields=*&f=json`; it could not be fetched, so its fields and its licence are not confirmed.
- **Effect:** no GNS records in the data; a `gns` position fails the check. Non-US landmarks outside Antarctica were dropped (see below).

## Earth landmarks dropped for want of a position
NASA pages state positions for some non-US places, but each one found was the centre or frame of an image, not the place itself. These were not used:
- Kilimanjaro: "Location: 3 degrees South latitude, 37 degrees East longitude" (SRTM perspective view, PIA03355 and Earth Observatory 2720).
- Mount Fuji: "The image is centered at 35.3 degrees north latitude, 138.7 degrees east longitude." (ASTER view).
- Mount Etna: "Location: 38 degrees North latitude, 15.5 degrees East longitude" (ASTER perspective view, looking south).
- Richat Structure: "Location: 21.2 degrees North latitude, 11.7 degrees West longitude" (SRTM view toward west-northwest).
- Mount Everest, the Great Barrier Reef, Uluru, Lake Eyre: searched; no NASA, USGS or ESA sentence stating a position was found (an Everest KML file gives image tile corners only). Other famous places (the Sahara, the Amazon, the Nile, the Himalaya) were not searched one by one, since the searches above found only image positions.
