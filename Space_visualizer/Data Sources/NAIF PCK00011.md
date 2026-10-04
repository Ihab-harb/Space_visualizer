---
title: NAIF PCK00011
publisher: NASA/JPL Navigation and Ancillary Information Facility (NAIF)
url: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc
used-for: [IAU rotation models, shape radii]
tags: [data-source]
---

# NAIF PCK00011

Back to [[Home]]

- **Publisher:** NASA/JPL Navigation and Ancillary Information Facility (NAIF)
- **URL:** https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc
- **Used for:** IAU WGCCRE 2015 rotation models (pole right ascension/declination, prime meridian, periodic terms) and shape radii (equatorial and polar).
- **Accuracy / caveats:** The IAU "north pole" of a planet is the pole on the north side of the invariable plane, so Venus and Uranus show 180° − obliquity relative to their orbit normal. Mars's model has large long-period terms (about 1.6° in declination) that must be included.
- **License:** NASA public domain
- **How it is refreshed:** `npm run data`
- **Parsed by:** `pipeline/sources/naifPck.ts`
