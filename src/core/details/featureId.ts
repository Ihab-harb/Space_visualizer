/** Lower case, accents removed, trimmed: the form names are compared and keyed in. */
export function foldText(s: string): string {
  return s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().trim();
}

/** A stable, URL-safe id for a feature name, e.g. "Chang'e Planitia" -> "chang-e-planitia". */
export function featureId(name: string): string {
  return foldText(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
