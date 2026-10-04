import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// Testing Library only auto-registers cleanup when Vitest globals are enabled; they are not here.
afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
