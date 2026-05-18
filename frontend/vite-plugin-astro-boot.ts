// Vite-плагин: на каждый запрос index.html собирает src/bootTheme.ts
// через esbuild в IIFE-бандл и вставляет inline в <head> на место
// <!-- BOOT_THEME --> плейсхолдера.
//
// Зачем не статический <script src="...">: нужна синхронность до
// первого пэйнта, без FOUC. Минифицированный IIFE inline = ~3-5KB
// в HTML, грузится одной HTTP-связью с документом.
//
// Кеш: бандлим один раз и переиспользуем (dev + production). При HMR
// исходник bootTheme.ts и его deps читаются на каждый rebuild Vite'а
// автоматически.
import type { Plugin } from 'vite';
import { build } from 'esbuild';
import path from 'node:path';

const PLACEHOLDER = '<!-- BOOT_THEME -->';

export function astroBootInline(): Plugin {
  let cached: string | null = null;

  async function bundle(rootDir: string): Promise<string> {
    if (cached !== null) return cached;
    const result = await build({
      entryPoints: [path.resolve(rootDir, 'src/bootTheme.ts')],
      bundle: true,
      write: false,
      format: 'iife',
      platform: 'browser',
      target: 'es2018',
      minify: true,
      legalComments: 'none',
    });
    cached = result.outputFiles[0].text;
    return cached;
  }

  return {
    name: 'astro-boot-inline',

    // На каждое изменение исходника инвалидируем кеш — следующий запрос
    // index.html пересоберёт.
    handleHotUpdate(ctx) {
      if (
        ctx.file.endsWith('/bootTheme.ts') ||
        ctx.file.endsWith('/themeEngine.ts') ||
        ctx.file.endsWith('/astroColors.ts') ||
        ctx.file.endsWith('/timezoneCoords.ts')
      ) {
        cached = null;
      }
    },

    transformIndexHtml: {
      order: 'pre',
      async handler(html, ctx) {
        if (!html.includes(PLACEHOLDER)) return html;
        const rootDir = ctx.server?.config.root ?? process.cwd();
        const code = await bundle(rootDir);
        return html.replace(PLACEHOLDER, `<script>${code}</script>`);
      },
    },
  };
}
