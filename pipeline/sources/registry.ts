import type { Source } from '../../src/core/catalog/schema';

export interface SourceSpec {
  id: string;
  title: string;
  publisher: string;
  url: string;
  license: string;
}

const NASA_PUBLIC_DOMAIN = 'NASA public domain (NASA media usage guidelines)';
const JPL_CONTENT = 'NASA/JPL public web content (JPL Image Use Policy, https://www.jpl.nasa.gov/jpl-image-use-policy)';

export const SOURCE_SPECS = {
  jplApproxPos: {
    id: 'jpl-approx-pos',
    title: 'Approximate Positions of the Planets (E. M. Standish and J. G. Williams)',
    publisher: 'NASA/JPL Solar System Dynamics',
    url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
    license: JPL_CONTENT,
  },
  jplHorizons: {
    id: 'jpl-horizons',
    title: 'Horizons System reference vectors (system barycentres, ecliptic J2000)',
    publisher: 'NASA/JPL Solar System Dynamics',
    url: 'https://ssd.jpl.nasa.gov/horizons/',
    license: JPL_CONTENT,
  },
  nssdcaPlanets: {
    id: 'nssdca-planetary-fact-sheet',
    title: 'Planetary Fact Sheet - Metric (D. R. Williams)',
    publisher: 'NASA Goddard Space Flight Center, NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/',
    license: NASA_PUBLIC_DOMAIN,
  },
  nssdcaSun: {
    id: 'nssdca-sun-fact-sheet',
    title: 'Sun Fact Sheet (D. R. Williams)',
    publisher: 'NASA Goddard Space Flight Center, NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html',
    license: NASA_PUBLIC_DOMAIN,
  },
  naifPck: {
    id: 'naif-pck00011',
    title: 'PCK00011 planetary constants kernel (IAU WGCCRE 2015 report values)',
    publisher: 'NASA/JPL Navigation and Ancillary Information Facility (NAIF)',
    url: 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc',
    license: NASA_PUBLIC_DOMAIN,
  },
  naifGm: {
    id: 'naif-gm-de440',
    title: 'gm_de440.tpc gravitational parameters (DE440 GM values)',
    publisher: 'NASA/JPL Navigation and Ancillary Information Facility (NAIF)',
    url: 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/gm_de440.tpc',
    license: NASA_PUBLIC_DOMAIN,
  },
  jplSatElem: {
    id: 'jpl-sats-elem',
    title: 'Planetary Satellite Mean Elements',
    publisher: 'NASA/JPL Solar System Dynamics',
    url: 'https://ssd.jpl.nasa.gov/sats/elem/',
    license: JPL_CONTENT,
  },
} satisfies Record<string, SourceSpec>;

export function nasaScienceSpec(bodyId: string, name: string, url: string): SourceSpec {
  return { id: `nasa-science-${bodyId}`, title: `${name} - NASA Science`, publisher: 'NASA', url, license: NASA_PUBLIC_DOMAIN };
}

export function planetSheetUrl(id: string): string {
  return `https://nssdc.gsfc.nasa.gov/planetary/factsheet/${id}fact.html`;
}

export function planetSheetSpec(id: string, name: string): SourceSpec {
  return {
    id: `nssdca-${id}-fact-sheet`,
    title: `${name} Fact Sheet (D. R. Williams)`,
    publisher: 'NASA Goddard Space Flight Center, NSSDCA',
    url: planetSheetUrl(id),
    license: NASA_PUBLIC_DOMAIN,
  };
}

export function toSource(spec: SourceSpec, retrievedAt: string): Source {
  return { ...spec, retrievedAt };
}
