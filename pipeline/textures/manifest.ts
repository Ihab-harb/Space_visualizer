import type { SourceSpec } from '../sources/registry';

const NASA_PD = 'NASA public domain (NASA media usage guidelines)';
const USGS_PD = 'USGS public domain (U.S. Government work)';
const EO = 'https://eoimages.gsfc.nasa.gov/images/imagerecords';
const USGS = 'https://planetarymaps.usgs.gov/mosaic';
const OPAL = 'https://archive.stsci.edu/hlsps/opal/cycle31';
const SVS = 'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851';

export const IMAGERY_SOURCE_SPECS: SourceSpec[] = [
  { id: 'nasa-blue-marble-ng', title: 'Blue Marble: Next Generation, July 2004 (R. Stöckli)', publisher: 'NASA Earth Observatory / Visible Earth', url: 'https://visibleearth.nasa.gov/images/74092', license: NASA_PD },
  { id: 'nasa-black-marble-2016', title: 'Earth at Night (Black Marble) 2016', publisher: 'NASA Earth Observatory / Visible Earth', url: 'https://visibleearth.nasa.gov/images/144898', license: NASA_PD },
  { id: 'nasa-blue-marble-clouds', title: 'Blue Marble: Clouds', publisher: 'NASA Earth Observatory / Visible Earth', url: 'https://visibleearth.nasa.gov/images/57747', license: NASA_PD },
  { id: 'nasa-topography', title: 'Topography (GEBCO 2008 data)', publisher: 'NASA Earth Observatory / Visible Earth', url: 'https://visibleearth.nasa.gov/images/73934', license: NASA_PD },
  { id: 'nasa-bathymetry', title: 'Bathymetry (GEBCO 2008 data)', publisher: 'NASA Earth Observatory / Visible Earth', url: 'https://visibleearth.nasa.gov/images/73963', license: NASA_PD },
  { id: 'usgs-mars-viking-color', title: 'Mars Viking Global Color Mosaic 925 m', publisher: 'USGS Astrogeology Science Center', url: 'https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m', license: USGS_PD },
  { id: 'usgs-mars-mola-dem', title: 'Mars MGS MOLA DEM 463 m', publisher: 'USGS Astrogeology Science Center (NASA MGS MOLA team data)', url: `${USGS}/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif`, license: USGS_PD },
  { id: 'usgs-mercury-md3-color', title: 'Mercury MESSENGER MDIS Basemap MD3 Color Mosaic 665 m', publisher: 'USGS Astrogeology Science Center (NASA MESSENGER data)', url: `${USGS}/Mercury_MESSENGER_MDIS_Basemap_MD3Color_Mosaic_Global_665m.tif`, license: USGS_PD },
  { id: 'usgs-mercury-dem', title: 'Mercury MESSENGER USGS DEM 665 m', publisher: 'USGS Astrogeology Science Center (NASA MESSENGER data)', url: `${USGS}/Mercury_Messenger_USGS_DEM_Global_665m_v2.tif`, license: USGS_PD },
  { id: 'usgs-venus-magellan-c3', title: 'Venus Magellan Global C3-MDIR Mosaic 2025m', publisher: 'USGS Astrogeology Science Center (NASA Magellan data)', url: 'https://astrogeology.usgs.gov/search/map/venus_magellan_global_c3_mdir_mosaic_2025m', license: USGS_PD },
  { id: 'stsci-opal', title: 'Outer Planet Atmospheres Legacy (OPAL) global maps', publisher: 'NASA/ESA Hubble Space Telescope via STScI MAST (OPAL program, PI A. Simon)', url: 'https://doi.org/10.17909/T9G593', license: 'Public HLSP data; acknowledge NASA/ESA HST OPAL program (PI: Simon, GO13937), archived by STScI' },
  { id: 'nasa-svs-deep-star-maps', title: 'Deep Star Maps 2020', publisher: 'NASA Goddard Scientific Visualization Studio', url: 'https://svs.gsfc.nasa.gov/4851', license: 'NASA public domain (credit NASA/Goddard SVS; Gaia DR2: ESA/Gaia/DPAC)' },
  { id: 'nssdca-saturn-rings', title: 'Saturnian Rings Fact Sheet (D. R. Williams)', publisher: 'NASA Goddard Space Flight Center, NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html', license: NASA_PD },
  { id: 'nssdca-uranus-rings', title: 'Uranus Rings Fact Sheet (D. R. Williams)', publisher: 'NASA Goddard Space Flight Center, NSSDCA', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/uranringfact.html', license: NASA_PD },
];

export type ProductId =
  | 'earth-day' | 'earth-night' | 'earth-clouds' | 'earth-topography' | 'earth-bathymetry'
  | 'mars-color' | 'mars-dem' | 'mercury-color' | 'mercury-dem' | 'venus-radar'
  | 'jupiter-opal' | 'saturn-opal' | 'uranus-opal' | 'neptune-opal'
  | 'sky-starmap-4k' | 'sky-starmap-8k' | 'saturn-ring-sheet' | 'uranus-ring-sheet';

export interface Product {
  url: string;
  cacheName: string;
  sourceId: string;
  approxBytes: number;
  hdOnly?: boolean;
  /** Degrees to roll the map east so that column 0 is −180° longitude (0 = already −180..180). */
  lonOffsetDeg: number;
}

export const PRODUCTS: Record<ProductId, Product> = {
  'earth-day': { url: `${EO}/74000/74092/world.200407.3x21600x10800.jpg`, cacheName: 'earth-day.jpg', sourceId: 'nasa-blue-marble-ng', approxBytes: 21_125_326, lonOffsetDeg: 0 },
  'earth-night': { url: `${EO}/144000/144898/BlackMarble_2016_3km.jpg`, cacheName: 'earth-night.jpg', sourceId: 'nasa-black-marble-2016', approxBytes: 8_106_233, lonOffsetDeg: 0 },
  'earth-clouds': { url: `${EO}/57000/57747/cloud_combined_8192.tif`, cacheName: 'earth-clouds.tif', sourceId: 'nasa-blue-marble-clouds', approxBytes: 35_870_468, lonOffsetDeg: 0 },
  'earth-topography': { url: `${EO}/73000/73934/gebco_08_rev_elev_21600x10800.png`, cacheName: 'earth-topography.png', sourceId: 'nasa-topography', approxBytes: 18_414_843, lonOffsetDeg: 0 },
  'earth-bathymetry': { url: `${EO}/73000/73963/gebco_08_rev_bath_21600x10800.png`, cacheName: 'earth-bathymetry.png', sourceId: 'nasa-bathymetry', approxBytes: 35_097_740, lonOffsetDeg: 0 },
  'mars-color': { url: `${USGS}/Mars_Viking_ClrMosaic_global_925m.tif`, cacheName: 'mars-color.tif', sourceId: 'usgs-mars-viking-color', approxBytes: 797_888_177, lonOffsetDeg: 0 },
  'mars-dem': { url: `${USGS}/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif`, cacheName: 'mars-dem.tif', sourceId: 'usgs-mars-mola-dem', approxBytes: 2_125_771_142, lonOffsetDeg: 0 },
  'mercury-color': { url: `${USGS}/Mercury_MESSENGER_MDIS_Basemap_MD3Color_Mosaic_Global_665m.tif`, cacheName: 'mercury-color.tif', sourceId: 'usgs-mercury-md3-color', approxBytes: 796_539_539, lonOffsetDeg: 0 },
  'mercury-dem': { url: `${USGS}/Mercury_Messenger_USGS_DEM_Global_665m_v2.tif`, cacheName: 'mercury-dem.tif', sourceId: 'usgs-mercury-dem', approxBytes: 530_934_581, lonOffsetDeg: 0 },
  'venus-radar': { url: `${USGS}/Venus_Magellan_C3-MDIR_Global_Mosaic_2025m.tif`, cacheName: 'venus-radar.tif', sourceId: 'usgs-venus-magellan-c3', approxBytes: 176_335_453, lonOffsetDeg: 0 },
  'jupiter-opal': { url: `${OPAL}/jupiter/hlsp_opal_hst_wfc3-uvis_jupiter-2024c_f395n-f502n-f631n_v1_globalmap.tif`, cacheName: 'jupiter-opal.tif', sourceId: 'stsci-opal', approxBytes: 19_472_820, lonOffsetDeg: 0 },
  'saturn-opal': { url: `${OPAL}/saturn/hlsp_opal_hst_wfc3-uvis_saturn-2024a_f395n-f502n-f631n_v1_globalmap.tif`, cacheName: 'saturn-opal.tif', sourceId: 'stsci-opal', approxBytes: 4_876_618, lonOffsetDeg: 0 },
  'uranus-opal': { url: `${OPAL}/uranus/hlsp_opal_hst_wfc3-uvis_uranus-2023a_f467m-f547m-f657n_v1_globalmap.tif`, cacheName: 'uranus-opal.tif', sourceId: 'stsci-opal', approxBytes: 787_710, lonOffsetDeg: 0 },
  'neptune-opal': { url: `${OPAL}/neptune/hlsp_opal_hst_wfc3-uvis_neptune-2025a_f467m-f547m-f657n_v1_globalmap.tif`, cacheName: 'neptune-opal.tif', sourceId: 'stsci-opal', approxBytes: 792_962, lonOffsetDeg: 0 },
  'sky-starmap-4k': { url: `${SVS}/starmap_2020_4k.exr`, cacheName: 'starmap-4k.exr', sourceId: 'nasa-svs-deep-star-maps', approxBytes: 35_997_085, lonOffsetDeg: 0 },
  'sky-starmap-8k': { url: `${SVS}/starmap_2020_8k.exr`, cacheName: 'starmap-8k.exr', sourceId: 'nasa-svs-deep-star-maps', approxBytes: 130_530_278, hdOnly: true, lonOffsetDeg: 0 },
  'saturn-ring-sheet': { url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html', cacheName: 'satringfact.html', sourceId: 'nssdca-saturn-rings', approxBytes: 5_565, lonOffsetDeg: 0 },
  'uranus-ring-sheet': { url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/uranringfact.html', cacheName: 'uranringfact.html', sourceId: 'nssdca-uranus-rings', approxBytes: 4_337, lonOffsetDeg: 0 },
};

export function imagerySpec(id: string): SourceSpec {
  const spec = IMAGERY_SOURCE_SPECS.find((s) => s.id === id);
  if (!spec) throw new Error(`Unknown imagery source "${id}"`);
  return spec;
}
