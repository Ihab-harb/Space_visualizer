---
title: USGS Gazetteer of Planetary Nomenclature
publisher: USGS Astrogeology Science Center / IAU Working Group for Planetary System Nomenclature
url: https://planetarynames.wr.usgs.gov/
used-for: [named surface features of Mercury, Venus, the Moon and Mars; landmark positions; feature type meanings]
tags: [data-source]
---

# USGS Gazetteer of Planetary Nomenclature

Back to [[Home]]

- **Publisher:** USGS Astrogeology Science Center, for the IAU Working Group for Planetary System Nomenclature
- **URL pattern:** `https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/<TARGET>_nomenclature_center_pts.zip` with TARGET MERCURY, VENUS, MOON or MARS.
- **Citation link:** the source record links the web page for the target, `https://planetarynames.wr.usgs.gov/Page/<TARGET>/target`, so a click opens a page instead of downloading the zip. The zip URL above is what the pipeline fetches.
- **Source ids:** `usgs-gazetteer-mercury`, `usgs-gazetteer-venus`, `usgs-gazetteer-moon`, `usgs-gazetteer-mars`; `usgs-gazetteer-descriptor-terms` for the type meanings (M2b.4a).
- **Used for:** the named-feature list in the details files: name, type, centre latitude and east longitude, diameter, origin text, approval year, and the total number of approved names.
- **How it is parsed:** the zip is read with the repo's own reader (`pipeline/lib/zip.ts`, Node `zlib`) and its `.dbf` with `pipeline/lib/dbf.ts`. `selectFeatures` in `pipeline/sources/gazetteer.ts` keeps rows whose approval starts with "Adopted", merges rows that are one feature listed twice (`dedupeRows`, see below), drops zero or missing diameters, and keeps the 200 largest. `thresholdKm` records the diameter of the smallest kept feature; `totalApproved` is the count of all approved features. Each feature gets a stable id (`featureId`, for example `olympus-mons`).
- **One row per feature (M2b.4a fix):** the Gazetteer's own file lists some features twice, with the same `link` (feature page) and values that differ slightly or not at all. Mercury had 614 approved rows for 606 features: eight names twice, seven of them in the top 200 (Discovery Rupes, Mirni Rupes, Kunisada, Michelangelo, Matisse, Milton, Lange; also Matabei). Mars has one (Bohar, identical rows, outside the top 200). The feature pages list both records side by side, so they cannot pick one; the build keeps the row whose diameter has more decimals (the first on a tie). Mercury now has 200 distinct features and `totalApproved` 606; the facts drawer's Mercury list changed with it. The build fails on a duplicate feature id. Details: [[2026-11-15-m2b4a-feature-pins]] (Execution record).
- **Landmarks (M2b.4a):** `findFeature` pulls one feature by its exact name at any size, so a landmark below the 200 cut (Tycho, about 85 km) has its Gazetteer position, size, type, origin and approval year. Explore pins every landmark at the Gazetteer's centre point.
- **Type meanings (M2b.4a):** the descriptor-terms page (https://planetarynames.wr.usgs.gov/DescriptorTerms) gives the meaning of each Latin type ("Mons · Mountain"). Each meaning is stored with a quote of its table row (two rows when one is under 6 words) and checked on the fetched page; the card shows only the meaning and its citation.
- **Checks:** schema validation, coordinate ranges, unique feature and landmark ids, a Gazetteer landmark equal to its features row, and sourceId resolution (`checkDetails`). The placement guards (`pipeline/textures/placement.test.ts`) check that Gazetteer positions land on their features in the committed maps.
- **Licence:** public domain (USGS)
- **Accuracy / caveats:** centre points are nominal; longitudes are east-positive 0-360 as supplied. The Mercury, Venus and Mars zips are about 12 MB in total; the Moon's is about 24 MB. A Gazetteer size can differ from a size stated in a landmark's quoted sentence (Mare Humorum 420 km against the basin's 825 km); the card shows both, each with its own source.
- **How it is refreshed:** `npm run data` (cache: `pipeline/raw/gazetteer-<TARGET>.zip`); `npm run data:offline` rebuilds from the cache.
- **Built by:** `pipeline/build/buildDetails.ts`
