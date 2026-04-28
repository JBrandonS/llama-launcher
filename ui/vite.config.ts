import { defineConfig } from 'vite';
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
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8290',
        changeOrigin: true,
      },
    },
  },
});
