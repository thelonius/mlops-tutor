import { useEffect } from 'react';
import { computeState, type AstroThemeState } from '../lib/themeEngine';
import darkHljsUrl from 'highlight.js/styles/github-dark.css?url';
import lightHljsUrl from 'highlight.js/styles/github.css?url';

// Astro-палитра: inline-boot уже посчитал и применил state до маунта.
// Этот хук подхватывает state, держит расписание на конец planetary-часа,
// слушает OS-смену темы и refresh при возврате на вкладку.
//
// При каждом recompute:
//   * пишет --color-* токены на :root
//   * меняет data-theme (dark|light) — для legacy CSS-правил
//   * меняет href у <link id="hljs-css"> на github/github-dark
//   * диспатчит CustomEvent('astro-theme-change') для UI-индикаторов
export function useAstroTheme(): void {
  useEffect(() => {
    // Coords из boot'а. Если по какой-то причине boot не отработал
    // (мы изолированы тестом, разработка через storybook и т.п.) —
    // фолбэк через тот же путь.
    const boot = window.__astroTheme;
    if (boot) {
      // Boot уже применил state — пересинхронизируем hljs CSS на всякий
      // случай (вдруг href не был выставлен).
      applyHljs(boot.state.mode);
    }

    const refresh = (): void => {
      if (!window.__astroTheme) return;
      const { coords } = window.__astroTheme;
      const state = computeState(new Date(), coords[0], coords[1]);
      applyState(state);
      window.__astroTheme.state = state;
      window.dispatchEvent(new CustomEvent('astro-theme-change', { detail: state }));
    };

    // Schedule на конец текущего planetary-часа. Раньше 1 секунды не
    // ставим — clamp от спин-локов на пограничных миллисекундах.
    let timer: number | undefined;
    const schedule = (): void => {
      if (!window.__astroTheme) return;
      const next = window.__astroTheme.state.hour.phaseEndTs;
      const ms = Math.max(1000, next - Date.now() + 250);
      timer = window.setTimeout(() => {
        refresh();
        schedule();
      }, ms);
    };

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onMqlChange = (): void => refresh();
    mql.addEventListener('change', onMqlChange);

    const onVisibility = (): void => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);

    schedule();

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      mql.removeEventListener('change', onMqlChange);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}

function applyState(state: AstroThemeState): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(state.palette)) {
    root.style.setProperty(k, v);
  }
  root.dataset.astroMode = state.mode;
  root.dataset.astroHourRuler = state.hour.ruler;
  root.dataset.astroDayRuler = state.hour.dayRuler;
  root.setAttribute('data-theme', state.mode);
  applyHljs(state.mode);
}

function applyHljs(mode: 'dark' | 'light'): void {
  const link = document.getElementById('hljs-css') as HTMLLinkElement | null;
  if (!link) return;
  const next = mode === 'dark' ? darkHljsUrl : lightHljsUrl;
  if (link.href !== next) link.href = next;
}
