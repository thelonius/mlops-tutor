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
    // Спец-режимы лениво грузятся через React.lazy в App.tsx, что уже даёт
    // отдельные чанки. Дополнительно режем node_modules на vendor-чанки,
    // чтобы инициальная загрузка не тащила markdown-цепочку при первом
    // визите если потом будут лениться сами bubble.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // react-markdown тянет за собой micromark/mdast/hast/unist/lowlight —
          // всё это в один markdown-чанк, грузится с chat-путём.
          if (
            id.includes('react-markdown') ||
            /node_modules\/(remark-|rehype-|mdast-|hast-|unist-|micromark|lowlight|trim-lines|space-separated-tokens|comma-separated-tokens|property-information|zwitch|ccount|escape-string-regexp|character-entities|decode-named-character-reference|html-url-attributes|devlop|estree-util|html-void-elements|vfile|bail|is-plain-obj|trough|unified|fault)/.test(
              id,
            )
          ) {
            return 'markdown';
          }
          // highlight.js НЕ ловим явно: Bubble.tsx (initial) импортит 6
          // языков из lib/languages, Cheatsheet (lazy) — lib/common со
          // всем набором. Если форсировать в один 'hljs' чанк, common
          // вытаскивается в initial-преlоад. Пусть rollup сам разнесёт:
          // 6 языков лягут в chat-граф, common — в CheatsheetView-чанк.
          if (id.includes('node_modules/marked/')) return 'marked';
          if (id.includes('react-dom')) return 'react-dom';
          if (/node_modules\/(react|scheduler)\//.test(id)) return 'react';
          return undefined;
        },
      },
    },
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
