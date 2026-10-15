---
title: USGS Gazetteer of Planetary Nomenclature
publisher: USGS Astrogeology Science Center / IAU Working Group for Planetary System Nomenclature
url: https://planetarynames.wr.usgs.gov/
used-for: [named surface features of Mercury, Venus and Mars]
tags: [data-source]
---

# USGS Gazetteer of Planetary Nomenclature

Back to [[Home]]

- **Publisher:** USGS Astrogeology Science Center, for the IAU Working Group for Planetary System Nomenclature
- **URL pattern:** `https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/<TARGET>_nomenclature_center_pts.zip` with TARGET MERCURY, VENUS or MARS.
- **Source ids:** `usgs-gazetteer-mercury`, `usgs-gazetteer-venus`, `usgs-gazetteer-mars`.
- **Used for:** the named-feature list in the details files: name, type, centre latitude and east longitude, diameter, origin text, approval year, and the total number of approved names.
- **How it is parsed:** the zip is read with the repo's own reader (`pipeline/lib/zip.ts`, Node `zlib`) and its `.dbf` with `pipeline/lib/dbf.ts`. `selectFeatures` in `pipeline/sources/gazetteer.ts` keeps rows whose approval starts with "Adopted", drops zero or missing diameters, and keeps the 200 largest. `thresholdKm` records the diameter of the smallest kept feature; `totalApproved` is the count of all approved names.
- **Checks:** schema validation, coordinate ranges, and sourceId resolution (`checkDetails`).
- **Licence:** public domain (USGS)
- **Accuracy / caveats:** centre points are nominal; longitudes are east-positive 0-360 as supplied. The three zips are about 12 MB in total.
- **How it is refreshed:** `npm run data` (cache: `pipeline/raw/gazetteer-<TARGET>.zip`); `npm run data:offline` rebuilds from the cache.
- **Built by:** `pipeline/build/buildDetails.ts`
