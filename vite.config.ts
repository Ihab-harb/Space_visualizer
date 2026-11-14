import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'pipeline/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
});
