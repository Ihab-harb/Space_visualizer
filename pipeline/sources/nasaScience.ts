import { decodeEntities, parseHtml } from '../lib/html';

export const DESCRIPTION_PAGES = {
  sun: 'https://science.nasa.gov/sun/',
  mercury: 'https://science.nasa.gov/mercury/',
  venus: 'https://science.nasa.gov/venus/',
  earth: 'https://science.nasa.gov/earth/facts/',
  moon: 'https://science.nasa.gov/moon/',
  mars: 'https://science.nasa.gov/mars/',
  jupiter: 'https://science.nasa.gov/jupiter/',
  saturn: 'https://science.nasa.gov/saturn/',
  uranus: 'https://science.nasa.gov/uranus/',
  neptune: 'https://science.nasa.gov/neptune/',
} as const;

export function parseMetaDescription(html: string): string {
  const meta = parseHtml(html)
    .querySelectorAll('meta')
    .find((m) => m.getAttribute('name') === 'description');
  const text = decodeEntities(meta?.getAttribute('content') ?? '').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('NASA Science page has no meta description');
  return text;
}
