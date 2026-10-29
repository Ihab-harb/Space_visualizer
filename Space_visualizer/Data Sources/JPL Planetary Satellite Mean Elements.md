---
title: JPL Planetary Satellite Mean Elements
publisher: NASA/JPL Solar System Dynamics
url: https://ssd.jpl.nasa.gov/sats/elem/
used-for: [Moon position outside the Horizons table]
tags: [data-source]
---

# JPL Planetary Satellite Mean Elements

Back to [[Home]]

- **Publisher:** NASA/JPL Solar System Dynamics
- **URL:** https://ssd.jpl.nasa.gov/sats/elem/
- **Source id:** `jpl-sats-elem`
- **Used for:** the Moon's mean orbital elements (the row for 301): semi-major axis a, eccentricity e, argument of pericentre ω, mean anomaly M, inclination i, longitude of node, sidereal period P, apsis period P(apsis) and node period P(node), at epoch 2000-01-01.5 (JD 2451545.0). The app uses them only where the Chebyshev table ([[JPL Horizons]], [[0008-moon-chebyshev-table]]) does not reach.
- **Accuracy / caveats:** the page warns that the elements are "not intended for ephemeris computation". The measured error against Horizons at the three far M1 reference dates is up to 784,535 km (about 175 degrees), because the 27.322 d period is rounded and its phase error grows over millennia. The app shows this number. The elements are listed as valid for -2999 to 3001. Open question for the user: see [[2026-10-29-session-m2b2-moon]].
- **Licence:** NASA/JPL public web content (JPL Image Use Policy)
- **How it is refreshed:** `npm run data`. The page is fetched and parsed every time; the build fails if the epoch is not 2000-01-01.5 or the warning text is gone.
- **Parsed by:** `pipeline/sources/jplSatElem.ts` (reads columns by position; a deferred minor finding)
