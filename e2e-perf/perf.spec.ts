import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const VIEW = '/?jd=2461317.5&pause=1&target=earth&dist=36000&azSun=90&el=12&fx=1';
const results: Record<string, unknown> = {};

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
    const r = await frameTimes(page, 5000);
    results[q] = { gpu, ...r };
    console.log(`perf ${q}: ${JSON.stringify(results[q])}`);
    test.info().annotations.push({ type: 'gpu', description: gpu });
  });
}

test('Auto settles without oscillating', async ({ page }) => {
  await page.goto(`${VIEW}&quality=auto`);
  await page.waitForSelector('.scene[data-textures-ready="true"]', { timeout: 60_000 });
  const levels: string[] = [];
  for (let i = 0; i < 40; i++) {
    levels.push((await page.locator('.scene').getAttribute('data-quality')) ?? '?');
    await page.waitForTimeout(500);
  }
  const changes = levels.filter((l, i) => i > 0 && l !== levels[i - 1]).length;
  results.auto = { levels, changes };
  console.log(`perf auto: ${levels.join(' ')}`);
  const oscillates = levels.some((l, i) => i >= 2 && l === levels[i - 2] && l !== levels[i - 1]);
  expect(oscillates).toBe(false);
});

test.afterAll(() => {
  mkdirSync('test-results/perf', { recursive: true });
  writeFileSync('test-results/perf/perf.json', JSON.stringify(results, null, 2));
});
