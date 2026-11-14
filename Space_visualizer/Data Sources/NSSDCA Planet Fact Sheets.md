---
title: NSSDCA Planet Fact Sheets
publisher: NASA Goddard Space Flight Center, NSSDCA
url: https://nssdc.gsfc.nasa.gov/planetary/factsheet/
used-for: [planet atmosphere composition, planet magnetic field, Sun photosphere composition and field]
tags: [data-source]
---

# NSSDCA Planet Fact Sheets

Back to [[Home]]

- **Publisher:** NASA Goddard Space Flight Center, NSSDCA (D. R. Williams)
- **URL pattern:** `https://nssdc.gsfc.nasa.gov/planetary/factsheet/<planet>fact.html` for the eight planets (for example `marsfact.html`); the Sun uses `sunfact.html` ([[NSSDCA Sun Fact Sheet]]).
- **Source ids:** `nssdca-<planet>-fact-sheet` for each planet (eight new sources). The Sun reuses `nssdca-sun-fact-sheet`. These are separate from the combined table `nssdca-planetary-fact-sheet` ([[NSSDCA Planetary Fact Sheet]]).
- **Used for:** the "Atmospheric composition" block (major gases in %, minor gases in ppm, aerosols as a note), the Magnetosphere block (dipole moment, tilt, offset, reference radius, surface field), and for the Sun the "Photosphere Composition" block and the field description.
- **How it is parsed:** `pipeline/sources/nssdcPlanetSheet.ts`. `sheetText` turns the page into text (sub and sup tags inlined); `parseComposition`, `parseMagnetosphere` and `parseSunField` read the blocks. Fixtures are in `pipeline/fixtures/planets/`. A planet with no dipole block whose `hasGlobalMagneticField` fact is false (Venus, Mars) gets `{ kind: 'none' }` citing that fact.
- **Checks:** schema validation of each details file, gas amounts that must not exceed 100 % in total, every sourceId resolving to a source, and the checks in `src/core/details/checks.ts`.
- **Licence:** NASA public domain
- **Accuracy / caveats:** values are rounded as printed; Mercury's "atmosphere" is an exosphere given as column abundances, so it carries a note and no percentage gases.
- **How it is refreshed:** `npm run data` (cache: `pipeline/raw/nssdca-<planet>-fact.html`); `npm run data:offline` rebuilds from the cache.
- **Built by:** `pipeline/build/buildDetails.ts`
