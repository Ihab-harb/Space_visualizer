---
title: NSSDCA Moon Fact Sheet
publisher: NASA Space Science Data Coordinated Archive
url: https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
used-for: [Moon physical and orbital facts, exosphere composition]
tags: [data-source]
---

# NSSDCA Moon Fact Sheet

Back to [[Home]]

- **Publisher:** NASA Space Science Data Coordinated Archive (NSSDCA)
- **URL:** https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
- **Source id:** `nssdca-moon-fact-sheet`
- **Used for:**
  - Orbit facts: mean distance from Earth (384,400 km), periapsis, apoapsis and the synodic period. These are the new facts `meanDistanceFromParentKm`, `periapsisKm`, `apoapsisKm` and `synodicPeriodDays`. Inclination and eccentricity are noted as "About Earth".
  - The exosphere: the "Estimated Composition (night, particles per cubic cm)" block (9 gases), stored as number densities in `cm⁻³`, all upper limits. The note is the sheet's caveat paragraph.
  - The Moon's interior conversion uses the catalogue radius (1,737.4 km, from [[NAIF PCK00011]]), because the Moon sheet has no mean-radius row that the parser reads.
- **Accuracy / caveats:** the sheet has a Moon column and an Earth column. The parser takes the first number of the first cell (the Moon). Labels lose their units, and the x1e24 and x1e6 scales are not checked. Methane and Ammonia have names only on the sheet; the formulas CH4 and NH3 are standard chemistry. Surface pressure reads 0 on the Planetary Fact Sheet.
- **Licence:** NASA public domain
- **How it is refreshed:** `npm run data` (cache file `nssdca-moon-fact.html`)
- **Parsed by:** `pipeline/sources/nssdcMoonSheet.ts` (`parseMoonFactSheet`, `parseMoonExosphere`)
