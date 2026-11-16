---
title: Earth names databases (GNIS, GNS, NOAA, GEBCO, NRCan, LINZ)
publisher: U.S. Geological Survey / U.S. Board on Geographic Names (GNIS); NOAA NCEI (volcanoes); IHO-IOC GEBCO (undersea features); Natural Resources Canada (CGNDB); Toitū Te Whenua LINZ (New Zealand Gazetteer); National Geospatial-Intelligence Agency (GNS, not in use)
url: https://www.usgs.gov/us-board-on-geographic-names/download-gnis-data
used-for: [positions of Earth landmarks]
tags: [data-source]
---

# Earth names databases (GNIS, GNS, NOAA, GEBCO, NRCan, LINZ)

Back to [[Home]] · Rules: [[0010-names-databases-for-earth-positions]] · Built in [[2026-11-15-m2b4a-feature-pins]] Tasks 5 and 12

The note keeps its first file name, so links to it still work. Every source below gives a position only: the sentence on a card always comes from NASA, USGS or ESA. Code: the registry `NAMES_SOURCES` in `pipeline/sources/namesDatabase.ts` (one entry per source: its cited source, its host, where it holds places, how to fetch a record, how to read it). Checks: `verifyLandmarks` in `pipeline/sources/landmarks.ts`. Fetched files are cached in `pipeline/raw/names-*`, so `npm run data:offline` rebuilds from the cache.

| Database | Where it is used | Landmarks | Source id |
|---|---|---|---|
| GNIS | United States, Antarctica | 21 | `usgs-gnis` |
| NOAA NCEI volcanoes | volcanoes anywhere | 12 | `noaa-ncei-volcano-locations` |
| GEBCO undersea names | undersea features anywhere | 4 | `gebco-undersea-feature-names` |
| NRCan CGNDB | Canada only | 4 | `nrcan-cgndb` |
| LINZ NZ Gazetteer | New Zealand only | 2 | `linz-nz-gazetteer` |
| GNS | (not in use) | 0 | none |

## GNIS (in use)
- **Publisher:** U.S. Geological Survey, for the U.S. Board on Geographic Names.
- **What it holds:** official names and one primary point for features in the 50 states, DC, Puerto Rico, the U.S. Virgin Islands, Guam, the Northern Mariana Islands, and Antarctica (names approved by the Advisory Committee on Antarctic Names).
- **URL pattern:** `https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/DomesticNames/DomesticNames_<ST>_Text.zip` (one state or territory) and `https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/Antarctica/Gazetteer_Antarctica_Text.zip`. The USGS download page names this bucket as The National Map Staged Products Directory.
- **Citation link:** the source record links the USGS page `https://www.usgs.gov/us-board-on-geographic-names/download-gnis-data`, so a click opens a page instead of a zip.
- **Source id:** `usgs-gnis`.
- **Format:** pipe-delimited UTF-8 text with a header line (a BOM at the start, CRLF line ends). Fields used: `feature_id` (the permanent Feature ID), `feature_name` (the official name), `feature_class` (the type), `prim_lat_dec`, `prim_long_dec` (decimal degrees, NAD83). The Antarctica zip also has `AntarcticaAllNames_Antarctica.txt`, which lists other names for a record (for example "Dry Valleys" for "McMurdo Dry Valleys"). Field meanings: `GNIS_file_format.pdf` in the same directory (dated October 2, 2026). A record with `0, 0` has no known location and is rejected.
- **Example record** (DomesticNames_AZ.txt, fetched 2026-11-15): `23907|Grand Canyon|Valley|Arizona|04|Mohave|015|Columbine Falls|06/27/1984|09/05/2019|Official|Board Decision|02/04/1925|360646N|1135946W|36.112764|-113.9960696|365130N|1113603W|36.8583209|-111.6007163`. The landmark's position is 36.112764° N, 246.0039304° E (113.9960696° W).
- **Licence:** public domain. The files' metadata says "Use constraints: None. Acknowledgment of the U.S. Geological Survey would be appreciated for products derived from these data." and "Access constraints: None".
- **Why the staged files and not one record:** the National Map `geonames` map service can be queried by `gaz_id`, but it returns reprojected geometry (it differs from the record in the fifth decimal) and gives a valley two unlabelled points. The record view in the Domestic Names search app needs a browser. A state file is about 1 to 3 MB zipped, under the plan's 50 MB limit.
- **Accuracy / caveats:** one point per name. For a stream or a valley the primary point is the mouth (the map service calls that layer "Streams (Mouth)"), so the Mississippi River's point is in its delta and the Grand Canyon's is at its west end. A lake's point is somewhere on the water. The state files carry no other names; only the Antarctica file does.
- **Landmark entry:** `{ "kind": "names-database", "database": "gnis", "recordId": "<Feature ID>", "area": "<ST or Antarctica>" }`. Only GNIS takes an `area`.
- **Test fixtures:** header and record lines cut from the fetched files: `pipeline/fixtures/names-gnis-*.txt`.

## NOAA NCEI Volcano Locations Database (in use, worldwide)
- **Publisher:** NOAA National Centers for Environmental Information (NCEI), a United States government agency. Documentation: https://www.ncei.noaa.gov/products/natural-hazards/tsunamis-earthquakes-volcanoes/volcanoes ("The Volcano Locations Database is a global list of over 1600 volcanoes. It includes information about the latitude, longitude, elevation, type of volcano, and last known eruption."). Dataset citation: doi:10.7289/V5JW8BSH (the page: "Please cite this data/database as doi:10.7289/V5JW8BSH."; the DOI opens the NCEI metadata page for the Global Significant Volcanic Eruptions Database, which the locations list belongs to).
- **Fetch:** one record by id, JSON: `https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/volcanolocs/<id>`. No key, login or cookie. (The list `.../volcanolocs` has 1,609 records in 9 pages of 200, `?page=N`; `itemsPerPage` above 200 is refused; `name=` does not filter, `id=` does.)
- **Fields used:** `id`, `name`, `morphology` (the type; "Unknown" is treated as no type, so the build fails), `latitude`, `longitude` (read as written in the JSON text, so the digits are the record's). Also `country`, not checked (worldwide source).
- **Licence:** U.S. Government data. NCEI metadata (https://data.noaa.gov/metaview/page?xml=NOAA/NESDIS/NGDC/MGG/Hazards/iso/xml/G10147.xml&view=getDataView): "Access Constraints Access to this dataset is unrestricted." and "Use Constraints While every effort has been made to ensure that these data are accurate and reliable within the limits of the current state of the art, NOAA cannot assume liability for any damages caused by any errors or omissions in the data…". Registered: `U.S. Government data (NOAA); dataset metadata: "Access to this dataset is unrestricted."; cite as doi:10.7289/V5JW8BSH`.
- **Example** (fetched 2026-11-16): `{"id":10106,"num":"0101-06=","newNum":211060,"name":"Etna","country":"Italy","region":"01","latitude":37.748,"longitude":14.999,"elevation":3357,"morphology":"Stratovolcano",...}` → Etna, Stratovolcano, `37.748, 14.999`.
- **Caveats:** the names are the database's own, often without "Mount" and without accents: Fujisan, Popocatepetl, Eyjafjallajokull, Tenerife (the Teide volcano). One point per volcano, given to 2 or 3 decimals.
- **Fixture:** `pipeline/fixtures/names-noaa-volcano-10106.json` (the response as fetched).

## IHO-IOC GEBCO Gazetteer of Undersea Feature Names (in use, worldwide)
- **Publisher:** the GEBCO Sub-Committee on Undersea Feature Names (SCUFN), under the International Hydrographic Organization and UNESCO's Intergovernmental Oceanographic Commission. Hosted by the IHO Data Centre for Digital Bathymetry at NOAA NCEI. Documentation: https://www.gebco.net/data-products/undersea-feature-names ("…maintains and makes available a digital gazetteer of the names, generic feature type and geographic position of features on the seafloor.").
- **Fetch:** the gazetteer's own API, documented by its OpenAPI file `https://www.ngdc.noaa.gov/gazetteer/docs/api/v1`: `https://www.ngdc.noaa.gov/gazetteer/api/v1/feature?featureId=<id>` (JSON, `items` with one feature). `/api/v1/feature/<id>` takes the changing state id, not the feature id, so the search by `featureId` is used. No key for reading. (The controller's earlier 403 on `/gazetteer` did not repeat with a plain browser user agent.)
- **Fields used:** `featureId`, `name` (the specific term, "Challenger"), `genericTerm` ("Deep"; also the type), `approvalState` (only `APPROVED` is used), `singlePointLatitude`, `singlePointLongitude` (the schema: "The point must lie within the geometry if it is a polygon or must equal a point in any other geometry."). The landmark name is the specific and the generic term together ("Challenger Deep"), the way an undersea feature name is formed; the specific term alone is kept as a variant.
- **Licence:** citation asked, no other terms stated. gebco.net and NCEI's own listings of the service: "Please include the following citation when data from the gazetteer are used or reproduced in reports, presentations and other products: IHO-IOC GEBCO Gazetteer of Undersea Feature Names, www.gebco.net". gebco.net's disclaimer: "GEBCO's data sets are not to be used for navigation or for any purpose relating to safety at sea." The cited source is the gebco.net page, as GEBCO asks.
- **Example** (fetched 2026-11-16): featureId 563, `"name":"Challenger","genericTerm":"Deep","approvalState":"APPROVED","singlePointLongitude":142.591667,"singlePointLatitude":11.373333,"maxDepth":10920` → Challenger Deep, Deep, `11.373333, 142.591667`.
- **Not used:** the same data on `services2.arcgis.com` (ArcGIS Online, a commercial platform), although the items there belong to NCEI.
- **Fixture:** `pipeline/fixtures/names-gebco-563.json`.

## Canadian Geographical Names Database, NRCan (in use, Canada only)
- **Publisher:** Natural Resources Canada, for the Geographical Names Board of Canada. Documentation: https://natural-resources.canada.ca/maps-tools-publications/maps/geographical-names-canada/download-geographical-names-data ("These files contain names recognized by the Geographical Names Board of Canada."). The web service describes itself in each response (links to JSON, CSV, KML and other forms).
- **Fetch:** one record by its key, CSV: `https://geogratis.gc.ca/services/geoname/en/geonames/<KEY>.csv` (five capital letters, for example `OAHKV`), and the concise code list `https://geogratis.gc.ca/services/geoname/en/codes/concise.json` (fetched once). Search: `https://geogratis.gc.ca/services/geoname/en/geonames.json?q=<name>`.
- **Fields used:** `id`, `name`, `concise.code` (the type is its term in the code list: `BAY-Bay` gives "Bay"), `province.code`, `latitude`, `longitude` (as written: `60.0`, `-86.0`).
- **Country check:** the record's `province.code` must be a province or territory (10 to 62). Codes 72 ("Undersea Feature") and 73 ("International Waters") are not Canadian land and fail the build.
- **Licence:** Open Government Licence – Canada. The NRCan page: "Use of the data is subject to the Open Government Licence - Canada." (The licence page itself, on open.canada.ca, answered "Request Rejected" to the fetcher.)
- **Example** (fetched 2026-11-16): `OAHKV,Hudson Bay,und,…,BAY,…,62,…,60.0,-86.0,1982-01-18` → Hudson Bay, Bay, `60.0, -86.0`, Nunavut (62). The same bay also has a French record, "Baie d'Hudson" (`OASUG`), at the same point.
- **Caveats:** Quebec names are French ("Réservoir Manicouagan", "Cratère des Pingualuit"). A wide feature has one coarse point (Hudson Bay at 60, -86).
- **Fixtures:** `names-nrcan-OAHKV.csv`, `names-nrcan-MABQB.csv` (Flemish Cap, an undersea feature, code 72), `names-nrcan-concise.json`.

## New Zealand Gazetteer, LINZ (in use, New Zealand only)
- **Publisher:** Toitū Te Whenua Land Information New Zealand, for the New Zealand Geographic Board. Documentation: https://www.linz.govt.nz/products-services/place-names/place-names-new-zealand ("If you want to re-use the information in the Gazetteer you can: download it as a .csv file from the Gazetteer.").
- **Fetch:** the whole gazetteer, one CSV: `https://gazetteer.linz.govt.nz/gaz.csv` (about 21 MB, 54,748 records; quoted fields hold commas and line breaks). The record is found by `name_id`. The record pages on gazetteer.linz.govt.nz are a browser app.
- **Fields used:** `name_id`, `name`, `feat_type` (the type), `land_district`, `crd_latitude`, `crd_longitude` (NZGD2000 for New Zealand records).
- **Country check:** the record must name a New Zealand land district. The gazetteer also holds the Ross Dependency of Antarctica (datum RSRGD2000) and undersea names; those records have no land district and fail the build.
- **Licence:** CC BY 4.0. https://www.linz.govt.nz/copyright: "Unless otherwise specified, content produced by Toitū Te Whenua Land Information New Zealand is licensed under the Creative Commons Attribution 4.0 International licence." The LINZ Data Service layer of the same names (51681, "NZ Place Names (NZGB)") states "Creative Commons Attribution 4.0 International".
- **Example** (fetched 2026-11-16): `7297,Aoraki/Mount Cook,Official Altered,26004,Hill,,,Canterbury,NZTM,5169100.0,1369300.0,NZGD2000,-43.595348,170.141926,…` → Aoraki/Mount Cook, Hill, `-43.595348, 170.141926`.
- **Caveats:** the class can read oddly: Aoraki/Mount Cook is a "Hill".
- **Fixture:** `pipeline/fixtures/names-linz-gaz.csv` (the header and three whole rows cut from the file: Aoraki/Mount Cook, Whakaari / White Island, and the Ross Dependency's Mount Erebus).

## GNS (not in use)
- **Publisher:** National Geospatial-Intelligence Agency (NGA), for the U.S. Board on Geographic Names. Coverage: the world outside the United States and Antarctica.
- **Status:** could not be reached. `geonames.nga.mil` timed out (TCP connect) on every try on 2026-11-15, from this machine and from the web fetch tool, from 09:55 to 10:30 UTC. `www.nga.mil` answered normally. The ArcGIS query form seen in search results was `https://geonames.nga.mil/geon-ags/rest/services/RESEARCH/GIS_OUTPUT/MapServer/0/query?where=ufi+%3D+<UFI>&outFields=*&f=json`; it could not be fetched, so its fields and its licence are not confirmed.
- **Effect:** a `gns` position fails the check. Its registry entry is kept, with its reason, so it can be switched on later.

## Looked at and not used (2026-11-16)
- **Australia, Composite Gazetteer of Australia** (Geoscience Australia with the state naming authorities): the map service `https://services.ga.gov.au/gis/rest/services/Composite_Gazetteer_of_Australia/MapServer/0` works and has `name`, `feature`, `latitude`, `longitude` fields (GDA94), but no licence is stated: data.gov.au lists the dataset and its services as "notspecified", the service's copyright text is "Geoscience Australia" and its WFS says only "Fees: None", "AccessConstraints: Geoscience Australia". Geoscience Australia's site licence (CC BY 4.0) excludes "content the copyright in which belongs to third parties", and the names belong to the state authorities. The catalogue record (ecat.ga.gov.au) answered 403. Not used; open for the user. The search site placenames.fsdf.org.au is a browser app.
- **UNESCO World Heritage list:** a Cloudflare challenge (HTTP 403) for the controller; not tried again.
- **NOAA's old gazetteer address:** the GEBCO gazetteer now answers there (above).
- **Commercial or volunteer copies** (GeoNames.org, OpenStreetMap, Wikidata, ArcGIS Online copies): not used, by the rule.

## Earth landmarks dropped for want of a position
Before Task 12, NASA pages were the only way to a position outside the United States and Antarctica, and each one found was the centre or frame of an image, not the place itself. These image positions were never used:
- Kilimanjaro: "Location: 3 degrees South latitude, 37 degrees East longitude" (SRTM perspective view, PIA03355 and Earth Observatory 2720). **Now in, from NOAA.**
- Mount Fuji: "The image is centered at 35.3 degrees north latitude, 138.7 degrees east longitude." (ASTER view). **Now in, as Fujisan, from NOAA.**
- Mount Etna: "Location: 38 degrees North latitude, 15.5 degrees East longitude" (ASTER perspective view, looking south). **Now in, from NOAA.**
- Richat Structure: "Location: 21.2 degrees North latitude, 11.7 degrees West longitude" (SRTM view toward west-northwest). Still out: no official point record reachable.
- Still out, with no reachable official point record or no licence: Mount Everest and the Himalaya, the Sahara, the Amazon, the Nile, the Great Barrier Reef, Uluru, Lake Eyre (Australia: no licence stated), Milford Sound (in the LINZ gazetteer, but no NASA, USGS or ESA sentence was found), Mount Logan (in NRCan, but the only NASA sentence names it in passing), the East Pacific Rise and the Emperor Seamounts (in GEBCO, but no sentence that reads on its own), Erta Ale and Cotopaxi (in NOAA, but no sentence that reads on its own).
