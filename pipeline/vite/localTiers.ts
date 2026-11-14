import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export const LOCAL_TIERS_ID = 'virtual:local-tiers';
const RESOLVED_ID = `\0${LOCAL_TIERS_ID}`;

/** HD texture files (_4k / _8k .webp) present under a textures folder, as site-relative paths. */
export function listLocalHdFiles(texturesDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string) => {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      const full = path.join(dir, name);
      const relPath = rel ? `${rel}/${name}` : name;
      if (statSync(full).isDirectory()) walk(full, relPath);
      else if (/_(4k|8k)\.webp$/.test(name)) out.push(`textures/${relPath}`);
    }
  };
  walk(texturesDir, '');
  return out.sort();
}

/** Exposes which HD tiers exist in this build, so the app never requests a git-ignored tier that is absent. */
export function localTiersPlugin(): Plugin {
  let texturesDir = '';
  return {
    name: 'local-tiers',
    configResolved(config) {
      texturesDir = path.join(config.publicDir, 'textures');
    },
    resolveId(id) {
      return id === LOCAL_TIERS_ID ? RESOLVED_ID : null;
    },
    load(id) {
      return id === RESOLVED_ID ? `export const LOCAL_HD_FILES = ${JSON.stringify(listLocalHdFiles(texturesDir))};` : null;
    },
  };
}
