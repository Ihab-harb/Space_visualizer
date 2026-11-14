import { defineConfig, devices } from '@playwright/test';

/** Real-GPU frame-time probe (spec §7). Not part of `npx playwright test`. */
export default defineConfig({
  testDir: 'e2e-perf',
  timeout: 180_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 1600, height: 900 } },
  projects: [
    {
      name: 'gpu',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 }, launchOptions: { args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] } },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
