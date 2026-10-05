import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listLocalHdFiles } from './localTiers';

describe('listLocalHdFiles', () => {
  it('lists only 4k/8k WebP files, as site-relative paths', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tiers-'));
    mkdirSync(path.join(root, 'earth'));
    mkdirSync(path.join(root, 'sky'));
    for (const f of ['earth/color_1k.webp', 'earth/color_4k.webp', 'earth/night_8k.webp', 'sky/color_4k.webp', 'imagery.json']) writeFileSync(path.join(root, f), '');
    expect(listLocalHdFiles(root)).toEqual(['textures/earth/color_4k.webp', 'textures/earth/night_8k.webp', 'textures/sky/color_4k.webp']);
  });
  it('returns an empty list when the folder does not exist', () => {
    expect(listLocalHdFiles(path.join(tmpdir(), 'does-not-exist-tiers'))).toEqual([]);
  });
});
