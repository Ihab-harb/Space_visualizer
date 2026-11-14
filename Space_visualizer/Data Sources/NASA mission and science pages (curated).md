---
title: NASA mission and science pages (curated)
publisher: NASA, NSSDCA, USGS
url: https://science.nasa.gov/
used-for: [interior layers, missions, discovery]
tags: [data-source]
---

# NASA mission and science pages (curated)

Back to [[Home]]

- **Publisher:** NASA science, mission and NSSDCA pages (hosts limited to nasa.gov, usgs.gov, esa.int, jaxa.jp, isro.gov.in, cnsa.gov.cn)
- **Used for:** interior layers (Sun, Mercury, Earth, Mars; the other planets have no official numeric source and show no interior), and missions and discovery for all nine bodies.
- **Where the values live:** `pipeline/reference/interiors.json` and `pipeline/reference/missions.json`, described in `pipeline/reference/README.md`.
- **The quote rule:** every curated value records the exact sentence it came from. The build fails if that sentence is not on the fetched page, if it is shorter than 6 words, or if the recorded number (km or percent, or a day-level date) does not appear in the sentence. Quotes are dropped from the output; only the value and its `sourceId` ship.
- **Conversion:** interior bounds are converted to radii by each bound's effective `from`: radius as is; depth becomes R minus depth; percent becomes R times p over 100. R is the body's cited mean radius (equatorial radius if there is none). Consecutive layers may differ at a boundary by up to max(40 km, 0.5 % of R).
- **Display:** the drawer prints each bound in the form its source states it (`from` and `stated` in the data), not the converted radius. A layer's state is cited only when a `stateSource` quote exists (Mars core: the InSight page).
- **Duplicate pages:** a curated source whose URL is already registered is aliased to the registered id when the details are built, so each page appears once in the Sources list.
- **Verified by:** `verifyInteriors` and `verifyMissions` in `pipeline/sources/quotedReference.ts`.
- **Licence:** NASA public domain (NASA media usage guidelines); USGS public domain
- **Accuracy / caveats:** layer boundaries are ranges where the source gives ranges; layers the source hedges are marked uncertain. Mission dates follow the source's own time zone convention.
- **How it is refreshed:** `npm run data` fetches each page to `pipeline/raw/ref-<sourceId>.html`; `npm run data:offline` uses the cache.
- **Built by:** `pipeline/build/buildDetails.ts`

## Pages used: interiors

- The Solar Interior (NASA/Marshall Solar Physics) (NASA Marshall Space Flight Center): https://solarscience.msfc.nasa.gov/interior.shtml (`nasa-msfc-solar-interior`)
- The Structure of the Sun (ISTP Workshop) (NASA Goddard Space Flight Center): https://pwg.gsfc.nasa.gov/istp/outreach/workshop/thompson/sundiag.html (`nasa-gsfc-sun-structure`)
- Mercury: Facts (NASA Science): https://science.nasa.gov/mercury/facts/ (`nasa-science-mercury-facts`)
- Facts About Earth (NASA Science): https://science.nasa.gov/earth/facts/ (`nasa-science-earth-facts`)
- Earth Fact Sheet (NASA NSSDCA): https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html (`nssdca-earth`)
- Mars: Facts (NASA Science): https://science.nasa.gov/mars/facts/ (`nasa-science-mars-facts`)
- NASA's InSight Reveals the Deep Interior of Mars (NASA / JPL): https://www.nasa.gov/centers-and-facilities/jpl/nasas-insight-reveals-the-deep-interior-of-mars/ (`nasa-insight-deep-interior`)

## Pages used: missions and discovery

- All About Mercury (NASA Space Place) (NASA Space Place): https://spaceplace.nasa.gov/all-about-mercury/en/ (`nasa-spaceplace-mercury`)
- Mariner 10 (NSSDCA Master Catalog) (NASA NSSDCA): https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1973-085A (`nssdca-mariner-10`)
- MESSENGER (NSSDCA Master Catalog) (NASA NSSDCA): https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2004-030A (`nssdca-messenger`)
- BepiColombo (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/bepicolombo/ (`nasa-mission-bepicolombo`)
- All About Venus (NASA Space Place) (NASA Space Place): https://spaceplace.nasa.gov/all-about-venus/en/ (`nasa-spaceplace-venus`)
- Mariner 2 (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/mariner-2/ (`nasa-mission-mariner-2`)
- Chronology of Lunar and Planetary Exploration (NSSDCA) (NASA NSSDCA): https://nssdc.gsfc.nasa.gov/planetary/chronology.html (`nssdca-planetary-chronology`)
- Magellan (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/magellan/ (`nasa-mission-magellan`)
- Venus Express (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/venus-express/ (`nasa-mission-venus-express`)
- Akatsuki (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/akatsuki/ (`nasa-mission-akatsuki`)
- Sputnik 1 (NASA Image Article) (NASA): https://www.nasa.gov/image-article/sputnik-1/ (`nasa-sputnik-1`)
- Explorer 1 (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/explorer-1/ (`nasa-mission-explorer-1`)
- TIROS 1 (NSSDCA Master Catalog) (NASA NSSDCA): https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1960-002B (`nssdca-tiros-1`)
- Landsat 1 (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/landsat-1/ (`nasa-mission-landsat-1`)
- Landsat 9 (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/landsat-9/ (`nasa-mission-landsat-9`)
- All About Mars (NASA Space Place) (NASA Space Place): https://spaceplace.nasa.gov/all-about-mars/en/ (`nasa-spaceplace-mars`)
- Mariner 4 (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/mariner-4/ (`nasa-mission-mariner-4`)
- Mariner 9 (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/mariner-9/ (`nasa-mission-mariner-9`)
- Viking 1 (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/viking-1/ (`nasa-mission-viking-1`)
- Mars Pathfinder (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/mars-pathfinder/ (`nasa-mission-mars-pathfinder`)
- Mars Global Surveyor (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/mars-global-surveyor/ (`nasa-mission-mars-global-surveyor`)
- Spirit (Mars Exploration Rover A) (NSSDCA Master Catalog) (NASA NSSDCA): https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2003-027A (`nssdca-spirit`)
- Opportunity (Mars Exploration Rover B) (NSSDCA Master Catalog) (NASA NSSDCA): https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2003-032A (`nssdca-opportunity`)
- Mars Science Laboratory: Curiosity Rover (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/msl-curiosity/ (`nasa-mission-msl-curiosity`)
- InSight (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/insight/ (`nasa-mission-insight`)
- Mars 2020 (Perseverance) (NSSDCA Master Catalog) (NASA NSSDCA): https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2020-052A (`nssdca-perseverance`)
- All About Jupiter (NASA Space Place) (NASA Space Place): https://spaceplace.nasa.gov/all-about-jupiter/en/ (`nasa-spaceplace-jupiter`)
- Pioneer 10 (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/pioneer-10/ (`nasa-mission-pioneer-10`)
- Voyager 1 (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/voyager-1/ (`nasa-mission-voyager-1`)
- Voyager 2 (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/voyager-2/ (`nasa-mission-voyager-2`)
- Galileo (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/galileo/ (`nasa-mission-galileo`)
- Juno (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/juno/ (`nasa-mission-juno`)
- Juice (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/juice/ (`nasa-mission-juice`)
- Europa Clipper (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/europa-clipper/ (`nasa-mission-europa-clipper`)
- Saturn: Facts (NASA Science) (NASA Science): https://science.nasa.gov/saturn/facts/ (`nasa-science-saturn-facts-history`)
- Pioneer 11 (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/pioneer-11/ (`nasa-mission-pioneer-11`)
- Cassini-Huygens (NASA JPL mission page) (NASA Jet Propulsion Laboratory): https://www.jpl.nasa.gov/missions/cassini-huygens/ (`nasa-jpl-cassini`)
- Uranus Fact Sheet (NSSDCA) (NASA NSSDCA): https://nssdc.gsfc.nasa.gov/planetary/factsheet/uranusfact.html (`nssdca-uranus-fact`)
- Neptune Fact Sheet (NSSDCA) (NASA NSSDCA): https://nssdc.gsfc.nasa.gov/planetary/factsheet/neptunefact.html (`nssdca-neptune-fact`)
- Helios 1 (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/helios-1/ (`nasa-mission-helios-1`)
- Ulysses (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/ulysses/ (`nasa-mission-ulysses`)
- SOHO (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/soho/ (`nasa-mission-soho`)
- Solar Dynamics Observatory (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/sdo/ (`nasa-mission-sdo`)
- Parker Solar Probe (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/parker-solar-probe/ (`nasa-mission-parker-solar-probe`)
- Solar Orbiter (NASA Science mission page) (NASA Science): https://science.nasa.gov/mission/solar-orbiter/ (`nasa-mission-solar-orbiter`)
