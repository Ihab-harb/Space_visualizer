import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { localTiersPlugin } from './pipeline/vite/localTiers';

export default defineConfig({
  plugins: [react(), localTiersPlugin()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'pipeline/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
});
