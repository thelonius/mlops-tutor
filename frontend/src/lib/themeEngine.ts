// Шим: движок палитры из пакета astro-palette.
//
// Сохранена точная конвенция mlops: геоцентрические hue + аспектная
// модуляция палитры, цветовой режим из OS. getColorMode остаётся здесь
// (DOM-зависимый, пакет фреймворконезависим). Типы переименованы под
// прежние имена потребителей (AstroThemeState, PlanetaryHourInfo).
import { computeState as _computeState } from 'astro-palette';
import type {
  AstroState,
  ColorMode,
  RoleSpec,
  SolarTimes,
  PaletteModulation,
  PlanetaryHour,
} from 'astro-palette';

export {
  PALETTE_SPEC,
  TOKEN_NAMES,
  computePalette,
  computeSolarTimes,
  getPlanetaryHour,
} from 'astro-palette';

export type { ColorMode, RoleSpec, SolarTimes, PaletteModulation };
export type AstroThemeState = AstroState;
export type PlanetaryHourInfo = PlanetaryHour;

/** Цветовой режим по OS-предпочтению. SSR/pre-JS фолбэк — 'dark'. */
export function getColorMode(): ColorMode {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Полное состояние палитры (конвенция mlops): геоцентрические долготы +
 * аспектная модуляция, mode из OS. Тонкая обёртка над computeState пакета.
 */
export function computeState(now: Date, lat: number, lon: number): AstroThemeState {
  return _computeState(now, lat, lon, {
    mode: getColorMode(),
    hueSource: 'geocentric',
    applyAspects: true,
  });
}
