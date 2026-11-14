---
title: Peer-reviewed papers (interior estimates)
tags: [data-source, interior, paper]
---

# Peer-reviewed papers (interior estimates)

Back to [[Home]] · Rules: [[0009-peer-reviewed-papers-for-estimates]] · Code: [[pipeline]] · Built in [[2026-10-30-m2b3-explore-interior]]

NASA's pages name the interior layers of Venus and the four giants but give no sizes. Where a layer size comes from a research paper, the layer is an **estimate** (`estimate: true`, `sizeKind: 'estimate'`) and the app shows the "Estimate" tag. Curated in `pipeline/reference/interiors.json`. Each quote is checked against the fetched page on every `npm run data`. In the build the page is the DOI landing page, or the open copy named as `quoteUrl`. The cache file is `pipeline/raw/ref-<id>.html`. Punctuation below is normalised (straight quotes, hyphens); the check normalises it the same way.

Layer names, states and compositions come from the NASA `/facts/` pages of each planet (the first citation, per the order of preference). This note lists the papers only.

## Papers used

### Maia and Wieczorek 2022 (Venus crust and the mantle's outer bound)
- **Authors, year:** Maia and Wieczorek, 2022.
- **Title:** "Lithospheric Structure of Venusian Crustal Plateaus".
- **Journal:** Journal of Geophysical Research: Planets, DOI [10.1029/2021JE007004](https://doi.org/10.1029/2021JE007004).
- **Open copy used:** arXiv [2202.06971](https://arxiv.org/abs/2202.06971). It carries the journal reference JGR Planets 127, e2021JE007004; the Crossref record of the DOI has the same abstract sentence word for word. Wiley's page answers 403.
- **Quote:** "The average crustal thickness of the plateaus ranges from 15 to 34 km, and if they are in Airy isostasy, this implies that the global average crustal thickness of Venus is about 20 km."
- **Backs:** the Venus crust, 0 to 20 km deep, and the mantle's outer bound (20 km deep). Only the 20 km is recorded. The 15 to 34 km is for the plateaus alone, and the 20 km depends on Airy isostasy, so both layers are `uncertain`. The UI says "about 20 km deep (global average)".

### Shah, Helled, Alibert and Mezger 2022 (Venus core and the mantle's inner bound)
- **Authors, year:** Shah, Helled, Alibert and Mezger, 2022.
- **Title (published):** "Possible Chemical Composition and Interior Structure Models of Venus Inferred from Numerical Modelling".
- **Journal:** The Astrophysical Journal, DOI [10.3847/1538-4357/ac410d](https://doi.org/10.3847/1538-4357/ac410d).
- **Open copy used:** arXiv [2112.03225](https://arxiv.org/abs/2112.03225) (v2, 9 December 2021; its title differs, "Interior Structure Models Of Venus"). Same authors. The abstract sentence matches the Crossref record of the published abstract; only punctuation differs. The IOP page also fetches fine.
- **Quote:** "We estimate that Venus' MoI is 0.317-0.351 and its core size 2930-4350 km for all assumed compositions."
- **Backs:** the Venus core radius range (2930 to 4350 km) and the mantle's inner bound. Drawn as a soft band; `uncertain`.
- **Documented exception to README rule 6:** the sentence says "core size", not "core radius". It is recorded as the radius. A core diameter of 2930 to 4350 km is impossible for Venus's mass, and the paper's body uses size and radius interchangeably: its Fig. 8 is "Core radius as a function of the redox state" and its parameter table has a "Core radius" row. Dumoulin et al. 2017 gives "2900 to 3450 km" for the core radius, which agrees with the low end. If this were wrong, the core would be drawn twice too large, which is impossible, so it is not plausible. The exception is written in `pipeline/reference/README.md` ("Documented exceptions"). Ruling in the plan's Execution record.

### Militzer and others 2022 (Jupiter dilute core)
- **Authors, year:** Militzer and co-authors (the Juno team), 2022. Read the full author list on the DOI page before quoting it elsewhere.
- **Title:** "Juno Spacecraft Measurements of Jupiter's Gravity Imply a Dilute Core".
- **Journal:** The Planetary Science Journal, DOI [10.3847/PSJ/ac7ec8](https://doi.org/10.3847/PSJ/ac7ec8).
- **Open copy used:** none needed. The quote is on the DOI landing page (IOP, open access), which the pipeline fetches.
- **Quote:** "a dilute core of heavy elements that are distributed as far out as 63% of the planet's radius"
- **Backs:** the Jupiter dilute core, 0 to 63 % of the radius (44,043.9 km on the built data). `uncertain`. The envelope and metallic hydrogen layers above it share 100 % to 63 % evenly, as illustrative sizes with no number. The core's gradual outer boundary is cited to NASA's Jupiter facts page ("no clear separation from the metallic hydrogen around it ... dilute, or "fuzzy""), not to this paper.

### Mankovich and Fuller 2021 (Saturn diffuse core)
- **Authors, year:** Mankovich and Fuller, 2021.
- **Title:** "A diffuse core in Saturn revealed by ring seismology".
- **Journal:** Nature Astronomy, DOI [10.1038/s41550-021-01448-3](https://doi.org/10.1038/s41550-021-01448-3).
- **Open copy used:** arXiv [2104.13385](https://arxiv.org/abs/2104.13385), v2 of 3 May 2021 (before the 16 August 2021 publication; no journal-ref field). The published Nature Astronomy page, fetched with a browser user agent, carries the identical sentence (the pipeline's own user agent is redirected to a cookie gate there). Semantic Scholar lists the arXiv PDF as the open copy of this DOI.
- **Quote:** "a diffuse, stably stratified core-envelope transition region in Saturn extending to approximately 60% of the planet's radius and containing approximately 17 Earth masses of ice and rock"
- **Backs:** the Saturn diffuse core, 0 to 60 % of the radius (34,939.2 km), its composition text and its gradual outer boundary ("diffuse ... transition region", drawn as a soft band). Not its state: the layer's state is `unknown` and shows no citation. `uncertain`. The UI says "about 60 % of the radius" (wording table, because the data has no field for "approximately").

## Candidates kept as official only
NASA `/facts/` pages used for names, order, states and compositions: Venus, Jupiter, Saturn, Uranus and Neptune. For Uranus and Neptune the layers are all `illustrative`: the NASA sentence "Most (80% or more) of the planet's mass is made up of a hot dense fluid of "icy" materials - water, methane, and ammonia - above a small rocky core" gives the order, not sizes. The UI shows "Layer sizes are not to scale" and the radius is shared in thirds, which overstates the core and the envelope-mantle position.

## Rejected candidates, and why
- **Dumoulin et al. 2017** (JGR Planets, 10.1002/2016JE005249): "core radius of 2900 to 3450 km" in the abstract, narrower and nicer than Shah. Wiley answers 403 and there is no arXiv or PubMed Central copy; ADS abstract pages answer 405. The quote cannot be checked.
- **James et al. 2013** (JGR Planets, 10.1029/2012JE004237): "mean thickness of the crust ... 8-25 km". Same Wiley 403, no open copy.
- **Margot et al. 2021** (Nature Astronomy, "Spin state and moment of inertia of Venus", 10.1038/s41550-021-01339-7): the abstract says only "a rough estimate of the size of the core". The DOI page redirects to a cookie gate.
- **Liu et al. 2019** (Nature, Jupiter's diluted core by a giant impact, arXiv 2007.08338): the abstract says "extending to nearly half of Jupiter's radius", with no digit or percent, so the number check cannot pass. It is also a formation model, not a measurement.
- **Wahl et al. 2017** (GRL, 10.1002/2017GL073160): "a significant fraction of the planet's radius", no number; Wiley 403.
- **Debras and Chabrier 2019** (ApJ), **Miguel et al. 2022** (A&A), **Howard et al. 2023** (A&A; "20% of Jupiter's mass" is mass, not radius), **Helled 2022** (Icarus review; "30% of the mass"), **Stevenson 2020** (Annual Review): no radius number in the abstracts.
- **Nettelmann et al. 2021** (arXiv 2110.15452): "out to 0.4 RSat" is a fraction with no percent or unit, and a model result. Mankovich and Fuller is better.
- **Saturn ring seismology** (Fuller 2014 Icarus, Mankovich 2019 ApJ, Dewberry 2021 PSJ): no layer size in the abstract. **Mankovich and Fuller 2023** (arXiv 2304.09215): "perhaps out to around one-half", no number.
- **Uranus and Neptune:**
  - Helled et al. 2011 (ApJ), Nettelmann 2013 and the arXiv papers 2412.06010 (Uranus, CORGI) and 2408.10336 (A&A 690): abstracts give no layer boundaries.
  - Neuenschwander and Helled 2022: MNRAS, not on the trusted list. Helled 2020: Philosophical Transactions (Phil Trans), not on the list.
  - Morf et al. 2025 (A&A 704 A183): only dynamo-region limits (0.69 to 0.74 and 0.78 to 0.92 of the radius), not layers.
  - Neuenschwander et al., A&A 706 A170 (2026; arXiv 2512.16995): density discontinuities "if present, are concentrated around a planetary normalised radius of 0.65 for Uranus and 0.7 for Neptune". No unit or percent, and it is about discontinuities, not a named envelope, mantle and core boundary. Using it would be our interpretation, so the layers stay illustrative.
- **Not used by rule:** the Oxford Research Encyclopedia (arXiv 1812.07436), EGU and EPSC abstracts, Philosophical Transactions (Phil Trans).

## Open copy checks
A host check cannot prove an open copy is the published or accepted version. For each copy, the curator compared the quote against a second copy of the published abstract (Crossref record, publisher page or both). Redo this when adding a paper. The fetch limits met: Wiley (agupubs) 403, Nature pages cookie-gated for the pipeline user agent, ADS abstract pages 405. IOP pages fetch fine.

## Rebuild
`npm run data` fetches the pages and checks the quotes. `npm run data:offline` rebuilds from the `pipeline/raw/` cache.
