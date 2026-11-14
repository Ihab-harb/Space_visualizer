---
title: NAIF GM DE440
publisher: NASA/JPL Navigation and Ancillary Information Facility (NAIF)
url: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/gm_de440.tpc
used-for: [Earth-Moon mass ratio]
tags: [data-source]
---

# NAIF GM DE440

Back to [[Home]]

- **Publisher:** NASA/JPL Navigation and Ancillary Information Facility (NAIF)
- **URL:** https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/gm_de440.tpc
- **Source id:** `naif-gm-de440`
- **Used for:** the gravitational parameters of the Moon (`BODY301_GM` = 4902.80011846 km^3/s^2) and the Earth (`BODY399_GM` = 398600.43550702 km^3/s^2). The Earth-Moon mass ratio is `mu = GM301 / (GM301 + GM399)` = 0.0121506 (stored as 0.012150584). It places Earth and the Moon about their common barycentre ([[core]]).
- **Accuracy / caveats:** DE440 values. The kernel is a text file; D and E exponents both occur.
- **Licence:** NASA public domain
- **How it is refreshed:** `npm run data`
- **Parsed by:** `pipeline/sources/naifGm.ts` (reuses the PCK assignment parser from [[NAIF PCK00011]])
