---
title: 0008 Moon position from a Chebyshev table
tags: [decision]
---

# 0008 Moon position from a Chebyshev table

Back to [[Home]] · Spec: [[2026-10-29-m2b2-moon-design]] · Plan: [[2026-10-29-m2b2-moon]] · Date: 2026-10-30 · Status: accepted, one open question

## Context
The Moon moves about 13 degrees a day, so a position that is off by an hour is off by 2,000 km. JPL's approximate planet formulas (used for the planets) have no Moon. JPL does publish mean elements for the Moon, but warns that they are "not intended for ephemeris computation". The app also draws Earth at the Earth-Moon barycentre (a known M1 limit), which is wrong by about 4,670 km once a Moon exists.

## Options
1. **JPL mean elements only.** Small and simple. Measured against Horizons they are far off (see below).
2. **A Horizons table compressed to Chebyshev polynomials,** with the mean elements as a fallback outside the table.
3. **Download Horizons vectors at run time.** Needs a network and an API at every visit. Rejected: the app must work offline from committed data.

## Decision
**Option 2.** `npm run moon:ephemeris` fetches Horizons geocentric Moon vectors for 1800 to 2051 and fits Chebyshev polynomials (16-day segments, degree 12). The file `moon.json` is loaded at startup. Inside its range the Moon is within 0.904 km (0.4792 arcsec) of Horizons, measured on 366,832 held-out samples. Outside the range the JPL mean elements give the position, and the drawer shows their measured error.

**Earth moves off the barycentre.** With `mu` = 0.0121506 from [[NAIF GM DE440]], Earth sits at the barycentre minus `mu` times the Moon's geocentric offset. A new Earth `centreCheck` measures the result against Horizons' Earth centre (6 samples, max 2,190 km radial, 11.8 arcsec). That error is Earth's own: it still rests on the approximate barycentre.

**Why 16 days, degree 12.** Four settings were fitted and measured on the odd 3-hour samples:

| Segment | Degree | Max error | Size |
|---|---|---|---|
| 8 d | 10 | 0.0167 km | 3.02 MB |
| 16 d | 12 | 0.904 km | 1.88 MB |
| 16 d | 14 | 0.146 km | 2.08 MB |
| 32 d | 18 | 7.28 km | 1.40 MB |

The smallest under 1 km wins. The first size reading (2.22 MB) fell under the 2 MB target once coefficients were rounded to clean decimals.

## Consequences
- **A 2 MB-class file loads at startup** (1.88 MB, before compression). The Moon waits for it; the other bodies do not.
- **The table covers 1800-01-01 to 4 days past 2051-01-01.** Segments are 16 days and 91,676 days has no divisor of 8, 16 or 32, so the table ends 4 days past the M1 end date (91,680 days).
- **The fallback is poor far from 1800 to 2050.** At the three far M1 reference dates the mean elements are off by up to 784,535 km, about 175 degrees (the 27.322-day period is rounded and its phase error grows). The status bar reads amber "extended" there although the Moon's position is effectively unknown. At a table edge the position jumps by thousands of km: the two models are not blended, because blending would invent positions.
- **Open question for the user:** extend the Horizons table to cover more years (more download), mark the Moon out of range outside the table, or keep it as it is. Listed in [[2026-10-29-session-m2b2-moon]].
- **Accuracy is measured, not claimed** ([[0004-measured-accuracy]]): both figures are stored in `bodies.json` and shown in the drawer.
- **Reuse:** the same table format and `systemState` suit other moons later. A satellite of a satellite, or a parent with several satellites, is not yet handled (deferred; none exist).
