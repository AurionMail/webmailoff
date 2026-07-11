import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // integration/** is the dockerized Playwright suite (run via
    // `npm run test:integration`); examples/** is untracked sample code. Both
    // use their own runners and must not be collected by vitest.
    exclude: ['e2e/**', 'integration/**', 'examples/**', 'node_modules/**', '.next/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
