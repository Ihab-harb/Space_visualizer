---
title: IERS leap seconds
publisher: IERS
url: https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat
used-for: [TAI − UTC table]
tags: [data-source]
---

# IERS leap seconds

Back to [[Home]]

- **Publisher:** International Earth Rotation and Reference Systems Service (IERS)
- **URL:** https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat
- **Used for:** The TAI − UTC table in `src/core/time/timescales.ts`, used to convert UTC to the TDB time scale of the ephemerides.
- **Accuracy / caveats:** Checked 2026-10-04: the last entry is 2017-01-01 (37 s). Update the table if IERS announces a new leap second.
- **License:** IERS public data product
- **How it is refreshed:** manual
- **Parsed by:** `src/core/time/timescales.ts`
