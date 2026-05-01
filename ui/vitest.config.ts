import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = resolve(__dirname, 'src');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': src,
      '@components': resolve(src, 'components'),
      '@modules': resolve(src, 'modules'),
      '@services': resolve(src, 'services'),
      '@state': resolve(src, 'state'),
      '@utils': resolve(src, 'utils'),
      '@hooks': resolve(src, 'hooks'),
      '@styles': resolve(src, 'styles'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/e2e/**', 'node_modules/**'],
  },
});
