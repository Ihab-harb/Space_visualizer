import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { analyseAutoLevels } from '../src/render/analyseAutoLevels';

const VIEW = '/?jd=2461317.5&pause=1&target=earth&dist=36000&azSun=90&el=12&fx=1';
const results: Record<string, unknown> = {};
const SOFTWARE = /swiftshader|llvmpipe|software|unknown/i;

function requireRealGpu(gpu: string): void {
  results.software = results.software === true || SOFTWARE.test(gpu);
  expect(SOFTWARE.test(gpu), `Renderer "${gpu}" is a software renderer or unknown. Run the perf probe on a real GPU (see docs/SETUP.md).`).toBe(false);
}

async function gpuName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
  });
}

async function frameTimes(page: Page, ms: number) {
  return page.evaluate(async (duration) => {
    const times: number[] = [];
    let last = performance.now();
    const end = last + duration;
    await new Promise<void>((resolve) => {
      const tick = (t: number) => {
        times.push(t - last);
        last = t;
        if (t < end) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    times.sort((a, b) => a - b);
    return { medianMs: times[times.length >> 1]!, p95Ms: times[Math.floor(times.length * 0.95)]!, frames: times.length };
  }, ms);
}

for (const q of ['high', 'medium', 'low'] as const) {
  test(`frame time at ${q}`, async ({ page }) => {
    await page.goto(`${VIEW}&quality=${q}`);
    await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 60_000 });
    await page.waitForTimeout(3000);
    const gpu = await gpuName(page);
    requireRealGpu(gpu);
    const r = await frameTimes(page, 5000);
    results[q] = { gpu, ...r };
    console.log(`perf ${q}: ${JSON.stringify(results[q])}`);
    test.info().annotations.push({ type: 'gpu', description: gpu });
  });
}

/**
 * Select/deselect hitch (final-review item I6): the longest frame within 1 s after selecting or deselecting Earth, next to
 * the longest frame in the 1 s before (the steady-state baseline at that preset). Three of each, at High.
 */
test('select and deselect hitch', async ({ page }) => {
  await page.goto(`${VIEW}&quality=high`);
  await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 60_000 });
  await page.waitForTimeout(3000);
  requireRealGpu(await gpuName(page));
  const selected = page.locator('.body-label.is-selected');
  const measure = (action: 'select' | 'deselect') =>
    page.evaluate(async (a) => {
      const longestFrame = (ms: number) =>
        new Promise<number>((resolve) => {
          let last = performance.now();
          const end = last + ms;
          let longest = 0;
          const tick = (t: number) => {
            longest = Math.max(longest, t - last);
            last = t;
            if (t < end) requestAnimationFrame(tick);
            else resolve(longest);
          };
          requestAnimationFrame(tick);
        });
      const target =
        a === 'select'
          ? document.querySelector<HTMLButtonElement>('.body-label[data-label-id="earth"]')
          : document.querySelector<HTMLButtonElement>('button[aria-label="Deselect"]');
      if (!target) throw new Error(`no control to ${a}`);
      const beforeMs = await longestFrame(1000);
      target.click();
      const afterMs = await longestFrame(1000);
      return { beforeMs, afterMs };
    }, action);
  const runs: Record<'select' | 'deselect', Array<{ beforeMs: number; afterMs: number }>> = { select: [], deselect: [] };
  for (let i = 0; i < 3; i++) {
    runs.deselect.push(await measure('deselect')); // the view starts with Earth selected
    await expect(selected).toHaveCount(0);
    await page.waitForTimeout(1500);
    runs.select.push(await measure('select'));
    await expect(selected).toHaveCount(1);
    await page.waitForTimeout(1500);
  }
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;
  const all = [...runs.select, ...runs.deselect];
  results.hitch = {
    preset: 'high',
    ...runs,
    medianAfterMs: med(all.map((r) => r.afterMs)),
    medianBeforeMs: med(all.map((r) => r.beforeMs)),
  };
  console.log(`perf hitch: ${JSON.stringify(results.hitch)}`);
});

test('Auto settles without oscillating', async ({ page }) => {
  await page.goto(`${VIEW}&quality=auto`);
  await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 60_000 });
  const levels: string[] = [];
  for (let i = 0; i < 40; i++) {
    levels.push((await page.locator('.scene').getAttribute('data-quality')) ?? '?');
    await page.waitForTimeout(500);
  }
  const analysis = analyseAutoLevels(levels);
  results.auto = { levels, ...analysis };
  console.log(`perf auto: ${levels.join(' ')}`);
  expect(analysis.reversed, 'Auto reversed direction within the window').toBe(false);
  expect(analysis.settled, 'Auto level still changing in the last 5 s').toBe(true);
});

test.afterAll(() => {
  results.software ??= false;
  mkdirSync('test-results/perf', { recursive: true });
  writeFileSync('test-results/perf/perf.json', JSON.stringify(results, null, 2));
});
