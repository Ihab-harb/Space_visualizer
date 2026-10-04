import { parse, type HTMLElement } from 'node-html-parser';

export type { HTMLElement };

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', dagger: '†', deg: '°',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith('#')) {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return NAMED[code.toLowerCase()] ?? match;
  });
}

export function parseHtml(html: string): HTMLElement {
  return parse(html);
}

/** Visible text of an element with entities decoded and whitespace collapsed. */
export function cellText(el: HTMLElement): string {
  return decodeEntities(el.rawText).replace(/\s+/g, ' ').trim();
}
