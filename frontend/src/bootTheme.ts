// Inline pre-paint theme bootstrap. Vite-плагин в vite.config.ts собирает
// этот модуль через esbuild в IIFE и вставляет inline в <head> на месте
// <!-- BOOT_THEME --> плейсхолдера. Работает синхронно до первого пэйнта,
// без сети, без permissions.
//
// После маунта React'а useAstroTheme берёт state из window.__astroTheme,
// слушает 'astro-theme-change' от manager'а и re-applies при смене часа
// или OS-темы.

import { computeState, type AstroThemeState } from './lib/themeEngine';
import { TZ_COORDS, FALLBACK_COORDS } from './lib/timezoneCoords';

declare global {
  interface Window {
    __astroTheme?: {
      state: AstroThemeState;
      coords: [number, number];
      tz: string | null;
    };
  }
}

(function bootstrap(): void {
  let tz: string | null = null;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    tz = null;
  }
  const coords: [number, number] = (tz && TZ_COORDS[tz]) || FALLBACK_COORDS;

  const now = new Date();
  const state = computeState(now, coords[0], coords[1]);

  const root = document.documentElement;
  for (const k in state.palette) {
    root.style.setProperty(k, state.palette[k]);
  }
  root.dataset.astroMode = state.mode;
  root.dataset.astroHourRuler = state.hour.ruler;
  root.dataset.astroDayRuler = state.hour.dayRuler;
  // Legacy data-theme — оставляем для CSS-правил, которые ещё ссылаются.
  root.setAttribute('data-theme', state.mode);

  window.__astroTheme = { state, coords, tz };
})();
