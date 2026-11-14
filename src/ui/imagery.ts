import type { Body, Imagery, TextureRef } from '../core/catalog/schema';

export interface ImageryLine {
  label: string;
  sourceId: string;
  derivation?: string;
  illustrative: boolean;
}

const LAYERS: Array<[Exclude<keyof Imagery, 'rings'>, string]> = [
  ['color', 'Surface'],
  ['normal', 'Relief'],
  ['night', 'Night lights'],
  ['clouds', 'Clouds'],
  ['specular', 'Water mask'],
  ['radar', 'Radar (Magellan)'],
];

const line = (label: string, ref: TextureRef): ImageryLine => ({
  label,
  sourceId: ref.sourceId,
  ...(ref.derivation ? { derivation: ref.derivation } : {}),
  illustrative: ref.illustrative === true,
});

export function imageryLines(body: Body): ImageryLine[] {
  const imagery = body.imagery;
  if (!imagery) return [];
  const lines = LAYERS.flatMap(([key, label]) => {
    const ref = imagery[key];
    return ref ? [line(label, ref)] : [];
  });
  if (imagery.rings) lines.push(line('Rings', imagery.rings.texture));
  return lines;
}

/** True when the Magellan radar mosaic is what is on screen (the scene uses the same condition). */
export function radarShown(body: Body, venusRadar: boolean): boolean {
  return body.render.shader === 'venus' && venusRadar && !!body.imagery?.radar;
}

/** Notes for what is on screen: the radar view replaces the cloud deck and the atmosphere shell. */
export function illustrativeNotes(body: Body, { venusRadar = false }: { venusRadar?: boolean } = {}): string[] {
  if (radarShown(body, venusRadar)) return ['Radar view: Magellan radar backscatter of the surface under the clouds — brightness is radar roughness, not visible light.'];
  const notes: string[] = [];
  if (body.render.shader === 'sun') notes.push('Illustrative surface: granulation, limb darkening and corona are artistic, not imagery.');
  else if (body.render.shader === 'venus') notes.push('Illustrative cloud deck: there is no official true-colour global map of Venus.');
  else if (!body.imagery?.color) notes.push('Illustrative colour — no official surface map.');
  if (body.render.bandFlow) notes.push('Cloud-band motion is illustrative.');
  if (body.render.shader === 'earth' && body.imagery?.clouds) notes.push('Cloud drift is illustrative.');
  if (body.render.atmosphere && body.render.atmosphere !== 'earth') notes.push('Atmosphere tint is illustrative.');
  return notes;
}
