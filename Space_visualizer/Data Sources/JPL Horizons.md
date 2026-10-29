---
title: JPL Horizons
publisher: NASA/JPL Solar System Dynamics
url: https://ssd.jpl.nasa.gov/horizons/
used-for: [reference vectors, accuracy measurement]
tags: [data-source]
---

# JPL Horizons

Back to [[Home]]

- **Publisher:** NASA/JPL Solar System Dynamics
- **URL:** https://ssd.jpl.nasa.gov/horizons/ (API: https://ssd.jpl.nasa.gov/api/horizons.api)
- **Used for:** Reference vectors (system barycentres 1–8, Sun centre, ecliptic J2000, TDB), committed in `pipeline/reference/horizons-heliocentric.json`. Used to test the planet model and to measure the error shown in each info panel. Since M2b.2 the file also holds 9 Earth-centre samples (command 399) that check where Earth is drawn once it leaves the barycentre.
- **Moon:** geocentric Moon vectors (command 301, centre 500@399, ecliptic J2000, TDB, 180-minute steps, 1800–2051) are fetched by `npm run moon:ephemeris`, compressed into the Chebyshev table `public/data/solar-system/ephemeris/moon.json` and checked against held-out samples ([[0008-moon-chebyshev-table]]). The check file is `pipeline/reference/horizons-moon-check.json`.
- **Accuracy / caveats:** Planet-*centre* ephemerides (199, 499, …) only cover limited spans (for example Jupiter 1600–2200), so the reference uses system barycentres, which DE441 covers for every reference date.
- **License:** NASA/JPL public web content (JPL Image Use Policy)
- **How it is refreshed:** `npm run horizons:reference` (reference vectors); `npm run moon:ephemeris` (the Moon's table)
- **Parsed by:** `pipeline/sources/horizons.ts` (`parseHorizonsVectorTable` rejects empty fields)
