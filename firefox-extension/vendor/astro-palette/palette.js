/**
 * Генерация OKLCH-палитры. Lightness/Chroma фиксированы на роль (гарантируют
 * контраст WCAG AA в обоих режимах), hue приходит снаружи: фон/текст/бордер от
 * управителя дня, accent от управителя часа, success/warn — семантические.
 * @module palette
 */

/**
 * @typedef {'dark'|'light'} ColorMode
 * @typedef {{L:number, C:number, hueOverride?:number}} RoleSpec
 */

/** @type {Record<ColorMode, Record<string, RoleSpec>>} */
export const PALETTE_SPEC = {
  dark: {
    bg:        { L: 14, C: 0.012 },
    surface:   { L: 19, C: 0.018 },
    text:      { L: 92, C: 0.005 },
    textMuted: { L: 68, C: 0.020 },
    accent:    { L: 75, C: 0.140 },
    border:    { L: 30, C: 0.018 },
    success:   { L: 78, C: 0.140, hueOverride: 145 },
    warn:      { L: 80, C: 0.140, hueOverride: 75 },
  },
  light: {
    bg:        { L: 98, C: 0.005 },
    surface:   { L: 95, C: 0.012 },
    text:      { L: 22, C: 0.008 },
    textMuted: { L: 45, C: 0.020 },
    accent:    { L: 42, C: 0.140 },
    border:    { L: 80, C: 0.020 },
    success:   { L: 50, C: 0.140, hueOverride: 145 },
    warn:      { L: 55, C: 0.130, hueOverride: 75 },
  },
};

/** Роль → имя CSS-переменной. @type {Record<string,string>} */
export const TOKEN_NAMES = {
  bg: '--color-bg', surface: '--color-surface',
  text: '--color-text', textMuted: '--color-text-muted',
  accent: '--color-accent', border: '--color-border',
  success: '--color-success', warn: '--color-warn',
};

/**
 * Палитра как map { '--color-*': 'oklch(...)' }.
 * @param {number} dayHue  hue фона/текста/бордера (управитель дня)
 * @param {number} hourHue hue accent'а (управитель часа)
 * @param {ColorMode} mode
 * @returns {Record<string, string>}
 */
export function computePalette(dayHue, hourHue, mode) {
  const spec = PALETTE_SPEC[mode];
  /** @type {Record<string,string>} */
  const out = {};
  for (const role of Object.keys(TOKEN_NAMES)) {
    const s = spec[role];
    let h;
    if (s.hueOverride !== undefined) h = s.hueOverride;
    else if (role === 'accent') h = hourHue;
    else h = dayHue;
    out[TOKEN_NAMES[role]] = `oklch(${s.L}% ${s.C.toFixed(4)} ${h})`;
  }
  return out;
}
