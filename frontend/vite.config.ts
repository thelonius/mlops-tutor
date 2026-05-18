import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  base: '/static/dist/',
  build: {
    outDir: path.resolve(__dirname, '../static/dist'),
    emptyOutDir: true,
    assetsDir: 'assets',
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      // Dev workflow: vite на 5174, Flask на 5050 (см. .claude/launch.json).
      '/api': 'http://127.0.0.1:5050',
    },
  },
});
