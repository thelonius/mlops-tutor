// Аспекты между планетами — углы по эклиптике. Классическая астрология
// признаёт несколько ключевых углов как «значимые»:
//
//   0°    conjunction — слияние, усиление обоих
//   60°   sextile     — мягкий хороший
//   90°   square      — напряжённый, трение
//   120°  trine       — гармоничный, лёгкий
//   180°  opposition  — противостояние, дугой через всё небо
//
// Орбис (допустимое отклонение от точного угла) — у астрологов варьируется,
// мы берём ±5° для всех аспектов: это узкое окно где аспект «активен».
//
// Используем аспекты не для текстов, а для вибрации палитры:
//   harmonic (trine, sextile) → +chroma на accent (насыщеннее)
//   tense    (square, opposition) → +lightness contrast (фон чуть темнее)
//   conjunction → +chroma + slight L-сдвиг (накапливается обоими эффектами)
//
// Это второе измерение уникальности палитры поверх hue: даже если
// долгота Mercury та же через год, аспекты с Mars/Saturn будут другими,
// и character палитры (мягкая/жёсткая) сдвинется.

import { planetEclipticLongitude } from './ephemerides';
import type { PlanetName } from './astroColors';

const ASPECT_TYPES = [
  { name: 'conjunction', angle: 0,   harmonic: 1 },   // условно гармоничный, мощный
  { name: 'sextile',     angle: 60,  harmonic: 1 },
  { name: 'square',      angle: 90,  harmonic: -1 },
  { name: 'trine',       angle: 120, harmonic: 1 },
  { name: 'opposition',  angle: 180, harmonic: -1 },
] as const;

const ORB = 5; // ±5° допустимого отклонения от точного угла

const PLANETS: PlanetName[] = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

export interface ActiveAspect {
  a: PlanetName;
  b: PlanetName;
  type: typeof ASPECT_TYPES[number]['name'];
  exactAngle: number;
  actualAngle: number;
  orbDistance: number; // абс. отклонение от точного угла
  harmonic: number;    // +1 или -1
}

/** Угол между двумя долготами, нормализованный к [0..180°]. */
function angleBetween(a: number, b: number): number {
  const diff = Math.abs(((a - b) % 360 + 360) % 360);
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Возвращает все активные аспекты между парами планет на момент jd.
 * Каждая пара даёт максимум один аспект (ближайший по orb).
 */
export function activeAspects(jd: number): ActiveAspect[] {
  const longitudes: Record<PlanetName, number> = {} as Record<PlanetName, number>;
  for (const p of PLANETS) longitudes[p] = planetEclipticLongitude(p, jd);

  const out: ActiveAspect[] = [];
  for (let i = 0; i < PLANETS.length; i++) {
    for (let j = i + 1; j < PLANETS.length; j++) {
      const a = PLANETS[i];
      const b = PLANETS[j];
      const angle = angleBetween(longitudes[a], longitudes[b]);
      let best: ActiveAspect | null = null;
      for (const aspect of ASPECT_TYPES) {
        const dist = Math.abs(angle - aspect.angle);
        if (dist <= ORB && (best === null || dist < best.orbDistance)) {
          best = {
            a, b,
            type: aspect.name,
            exactAngle: aspect.angle,
            actualAngle: angle,
            orbDistance: dist,
            harmonic: aspect.harmonic,
          };
        }
      }
      if (best) out.push(best);
    }
  }
  return out;
}

export interface AspectModulation {
  chromaBoost: number;        // +X к C accent'а (0..0.04)
  lightnessBoost: number;     // +X к L bg-разнице (0..3)
  aspects: ActiveAspect[];
}

/**
 * Суммирует активные аспекты в «модуляторы» палитры:
 * - chroma boost — насыщенность accent'а (гармоничные дни ярче)
 * - lightness boost — контраст L между bg и surface (напряжённые дни жёстче)
 *
 * Вес каждого аспекта — обратный orb (точные аспекты влияют сильнее).
 * Кэп: chroma ≤ +0.04, L delta ≤ +3 — палитра остаётся в OKLCH gamut'е.
 */
export function aspectModulation(jd: number): AspectModulation {
  const aspects = activeAspects(jd);
  let chromaBoost = 0;
  let lightnessBoost = 0;
  for (const a of aspects) {
    const tightness = 1 - a.orbDistance / ORB; // 1 на точном, 0 на границе орба
    if (a.harmonic > 0) {
      chromaBoost += 0.012 * tightness;
    } else {
      lightnessBoost += 1.2 * tightness;
    }
  }
  return {
    chromaBoost: Math.min(chromaBoost, 0.04),
    lightnessBoost: Math.min(lightnessBoost, 3),
    aspects,
  };
}
