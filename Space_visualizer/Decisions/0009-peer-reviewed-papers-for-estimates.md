---
title: 0009 Peer-reviewed papers for estimates
tags: [decision]
---

# 0009 Peer-reviewed papers for estimates

Back to [[Home]] · Spec: [[2026-10-30-m2b3-explore-interior-design]] §4.2 · Date: 2026-10-30 · Status: accepted

## Context
The project cites official sources only (NASA, JPL, NSSDCA, USGS, ESA, NAIF, IERS, STScI). The Explore interior cutaway needs layer sizes for every body. For Venus and the four giant planets, no official page gives numbers for the interior. NASA describes the layers in words, and the measured sizes live in mission papers (Juno, Cassini, Magellan, Voyager).

## Options
1. **Keep official sources only.** Venus and the giants would show no interior, or an interior with no cited size.
2. **Allow any web source for these values.** Breaks the rule that every value is trustworthy and checkable.
3. **Allow peer-reviewed research papers, and only where official sources give no numbers.**

## Decision
**Option 3** (the user, 2026-10-30). The source rule is amended for interior layers, with the same verification as every curated value.

Rules, as implemented in `pipeline/sources/quotedReference.ts`:
- **Order of preference:** an official source with a number, then an official source that names the layer plus a paper for its size, then a paper alone.
- **What counts as a paper:** `kind: 'paper'` with a DOI (`10.xxxx/...`), `url` equal to `https://doi.org/<doi>` (https only; `quoteUrl` is https too), and `journal` from `TRUSTED_JOURNALS` (canonical titles; a known alias such as `JGR Planets`, `A&A`, `ApJ` or `PSJ` is accepted and normalised, and `publisher` must equal the canonical title): Nature, Science, Nature Astronomy, Journal of Geophysical Research: Planets, Geophysical Research Letters, Icarus, The Planetary Science Journal, Astronomy & Astrophysics, The Astrophysical Journal, Annual Review of Earth and Planetary Sciences, Space Science Reviews. No preprint that was never published, no press release, no encyclopaedia.
- **Same quote check:** each value keeps the exact sentence it came from, checked against the fetched page. The page is `quoteUrl` when given, else the DOI landing page. `quoteUrl` may only be an open copy of the same paper on `arxiv.org`, `ncbi.nlm.nih.gov` (PubMed Central) or `ui.adsabs.harvard.edu` (`OPEN_COPY_HOSTS`). The copy must be the published or accepted version of the paper; the host check cannot prove that, so the curator must. The page goes into the `pipeline/raw/` cache like every other source. If no copy can be fetched, the value is not used.
- **Shown as estimates:** any layer that cites a paper anywhere (bound, state or composition) must have `estimate: true`. A layer with a paper bound also needs `sizeKind: 'estimate'`, and `sizeKind: 'estimate'` needs a paper bound. The build rejects every other combination.
- **Fractions and ranges:** a fraction of the radius is a `percent` bound, converted with the body's cited mean radius exactly as M2b.1 does, with the paper's own numbers kept in `stated`. A range stays a range.
- **Illustrative size:** where no acceptable number is found, the layer has `sizeKind: 'illustrative'` and no bounds. It shares the radius evenly with the other bound-less layers in its run, between its cited neighbours (or the whole radius if there are none). It shows no number. An interior made only of illustrative layers is allowed. The check fails an illustrative layer that has no room between its neighbours.
- **Source records:** a paper is registered as an ordinary `Source` (title = paper title, publisher = journal, url = DOI link, license "Peer-reviewed article; quoted under fair use"). `kind`, `doi`, `journal` and `quoteUrl` stay in the curated file only, so the app's `Source` schema is unchanged.

## Consequences
- The curated schema gains `kind`, `doi`, `journal`, `quoteUrl` (sources) and `sizeKind`, `estimate` (layers). The details schema gains `estimate` and `sizeKind`; an illustrative layer may omit both radius bounds. Existing data does not change.
- The UI must handle layers without bounds (done minimally in M2b.3 Task 3; the Explore view labels them "Illustrative size").
- A paper's number is only as good as its model. Estimates carry the "Estimate" label and cite the journal article.
- Revisit the journal list if a needed paper sits in a journal not on it. Adding one is a code change and a new decision note.

## What the build changed (M2b.3, 2026-10-30 to 2026-11-06)
- **Canonical titles.** The first draft matched `journal` against short names. The build keeps canonical titles in `TRUSTED_JOURNALS` with an alias table (ruling, Task 3), so a curator may write `JGR Planets` and the data holds "Journal of Geophysical Research: Planets". `publisher` is the canonical title.
- **Estimate rule widened.** A layer that cites a paper for its size, state or composition must be marked `estimate` (review finding, Task 3). A layer sized from a paper must be `sizeKind: 'estimate'`.
- **https only** for `url` and `quoteUrl`.
- **Open copy is not proof of version.** `quoteUrl` is host-checked only. The curator confirms the copy is the published or accepted version and records how in [[Peer-reviewed papers (interior estimates)]]. The host check cannot prove it (deferred minor).
- **One documented exception.** Shah et al. 2022 says "core size 2930-4350 km". It is recorded as the core radius range. See the data note and `pipeline/reference/README.md` ("Documented exceptions").
- **Coverage reached.** Four papers back Venus (crust, mantle, core), Jupiter's dilute core and Saturn's diffuse core. Uranus and Neptune are illustrative only: no paper gave a layer boundary that could be cited without interpretation. The better Venus papers (Dumoulin 2017, James 2013) could not be used because their pages cannot be fetched for the quote check. Rejected candidates are listed in the data note.
- **Open for the user:** the journal list and the trusted-paper call are in the spec §10 (call 5). The user has not yet reviewed them.
