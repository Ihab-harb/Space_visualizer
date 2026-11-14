---
title: JPL Approximate Positions of the Planets
publisher: NASA/JPL Solar System Dynamics
url: https://ssd.jpl.nasa.gov/planets/approx_pos.html
used-for: [planet orbits, nominal errors, semi-major axes]
tags: [data-source]
---

# JPL Approximate Positions of the Planets

Back to [[Home]]

- **Publisher:** NASA/JPL Solar System Dynamics (E. M. Standish and J. G. Williams)
- **URL:** https://ssd.jpl.nasa.gov/planets/approx_pos.html
- **Used for:** Planet orbits (Tables 1, 2a, 2b), the published nominal errors, J2000 semi-major axes.
- **Accuracy / caveats:** Nominal errors are 10″–600″ for 1800–2050 and up to 2000″ for 3000 BC–AD 3000. The elements are a best fit and are not valid outside their ranges. With Table 1, Neptune measures at up to ~4.5× (direction) and ~7× (distance) its published nominal error; see [[JPL Horizons]] and [[0004-measured-accuracy]].
- **License:** NASA/JPL public web content (JPL Image Use Policy)
- **How it is refreshed:** `npm run data`
- **Parsed by:** `pipeline/sources/jplApproxPos.ts`
