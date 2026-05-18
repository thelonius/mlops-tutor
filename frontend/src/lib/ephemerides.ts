// Эклиптическая долгота для каждого планетарного управителя.
// Используется как HUE для accent / day-bg в astro-палитре.
//
// Точность: достаточно для цветогенерации (±несколько угловых минут),
// не для астрономии. Без внешних эфемерид, без таблиц — только полиномы
// Meeus'а и упрощённый VSOP87 mean elements.
//
// Reference frames:
//   Sun, Moon → geocentric (видимая долгота с Земли)
//   Mercury, Venus, Mars, Jupiter, Saturn → heliocentric mean longitude
//     + первый порядок equation of center (eccentricity correction)
//
// Микс frame'ов — конкретно для hue это не важно: нужно лишь монотонно
// меняющееся 0..360 для каждого тела, на разных угловых скоростях.
// Точные геоцентрические аппарентные долготы потребовали бы Earth-vector
// вычитания (Kepler equation), для нашего случая overkill.
import type { PlanetName } from './astroColors';

const J2000 = 2451545.0;

/** Дата → Julian Date. JS getTime() — миллисекунды от Unix epoch 1970-01-01. */
export function toJulianDate(d: Date): number {
  return d.getTime() / 86400000 + 2440587.5;
}

function rad(x: number): number {
  return (x * Math.PI) / 180;
}

function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

/**
 * Солнце: геоцентрическая истинная эклиптическая долгота.
 * Meeus, Astronomical Algorithms, глава 25 (low-precision). Точность ~0.01°.
 */
export function sunLongitude(jd: number): number {
  const T = (jd - J2000) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const Mdeg = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const M = rad(Mdeg);
  // Equation of center, до 3-го порядка по эксцентриситету.
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
    0.000289 * Math.sin(3 * M);
  return norm360(L0 + C);
}

/**
 * Луна: геоцентрическая эклиптическая долгота.
 * Meeus, глава 47, усечено до 4 главных периодических членов. Точность ~0.2°
 * (для hue хватает — Луна за сутки проходит ~13°).
 */
export function moonLongitude(jd: number): number {
  const T = (jd - J2000) / 36525;
  const L = 218.3164591 + 481267.88134236 * T;
  const D = rad(297.8501921 + 445267.1114034 * T);
  const M = rad(357.5291092 + 35999.0502909 * T);
  const Mp = rad(134.9633964 + 477198.8675055 * T);
  const dL =
    6.288774 * Math.sin(Mp) +
    1.274027 * Math.sin(2 * D - Mp) +
    0.658314 * Math.sin(2 * D) -
    0.185116 * Math.sin(M);
  return norm360(L + dL);
}

/**
 * Mean orbital elements at J2000 для внешних/внутренних планет.
 * Источник: JPL Approximate Positions of the Planets, Standish 1992.
 *   L0   — mean longitude at J2000 (deg)
 *   dL   — mean motion (deg / Julian century)
 *   e    — eccentricity at J2000
 *   varpi — longitude of perihelion at J2000 (deg)
 */
interface OrbitalElements {
  L0: number;
  dL: number;
  e: number;
  varpi: number;
}

type PlanetWithOrbit = 'Mercury' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn';

/** Семисоси орбит планет (AU). J2000 mean values, JPL. */
const SEMI_AXIS: Record<PlanetWithOrbit, number> = {
  Mercury: 0.38710,
  Venus:   0.72333,
  Mars:    1.52371,
  Jupiter: 5.20289,
  Saturn:  9.53668,
};

const PLANET_ELEMENTS: Record<PlanetWithOrbit, OrbitalElements> = {
  Mercury: { L0: 252.25032350, dL: 149472.67411175, e: 0.20563593, varpi: 77.45779628 },
  Venus:   { L0: 181.97909950, dL: 58517.81538729,  e: 0.00677672, varpi: 131.60246718 },
  Mars:    { L0: 355.43299958, dL: 19140.30268499,  e: 0.09339410, varpi: 336.04084084 },
  Jupiter: { L0: 34.39644051,  dL: 3034.74612775,   e: 0.04838624, varpi: 14.72847983 },
  Saturn:  { L0: 49.95424423,  dL: 1222.49362201,   e: 0.05386179, varpi: 92.59887831 },
};

interface HelioState {
  trueLongDeg: number; // истинная гелиоцентрическая долгота, 0..360°
  trueAnomaly: number; // ν в радианах — нужна для r через r = a(1-e²)/(1+e cosν)
  e: number;
  a: number;
}

/**
 * Гелиоцентрический «момент» планеты на jd: истинная долгота + истинная
 * аномалия + параметры эллипса. Из этого получается helio (x, y) на
 * эклиптике для geo-перевода.
 */
function planetHelioState(name: PlanetWithOrbit, jd: number): HelioState {
  const el = PLANET_ELEMENTS[name];
  const T = (jd - J2000) / 36525;
  const L = el.L0 + el.dL * T;
  const M = rad(L - el.varpi);
  const e = el.e;
  // Equation of center до 2-го порядка по e.
  const Crad =
    (2 * e - (e * e * e) / 4) * Math.sin(M) +
    (5 / 4) * e * e * Math.sin(2 * M);
  const trueLongDeg = norm360(L + (Crad * 180) / Math.PI);
  const trueAnomaly = M + Crad;
  return { trueLongDeg, trueAnomaly, e, a: SEMI_AXIS[name] };
}

/** helio (x, y) на эклиптике в AU. */
function helioXY(state: HelioState): { x: number; y: number } {
  const r = (state.a * (1 - state.e * state.e)) / (1 + state.e * Math.cos(state.trueAnomaly));
  const L = rad(state.trueLongDeg);
  return { x: r * Math.cos(L), y: r * Math.sin(L) };
}

/**
 * Геоцентрическая видимая эклиптическая долгота планеты.
 *
 * Сокращение: гелио (x, y) планеты минус гелио (x, y) Земли. Земля
 * берётся через Sun geocentric long + 180°, эксцентриситет (0.0167)
 * игнорируется — для меток зодиака погрешность <0.1°.
 *
 * Эта формула корректно показывает ретроградность: когда планета и
 * Земля близки (Mercury, Venus около inferior conjunction, или Mars
 * около opposition), относительное движение становится обратным —
 * planet appears to move backwards.
 */
function planetGeoLongitude(name: PlanetWithOrbit, jd: number): number {
  const planet = helioXY(planetHelioState(name, jd));
  // Земля гелиоцентрически на L_sun + 180°, радиус ≈ 1 AU.
  const L_e = rad(norm360(sunLongitude(jd) + 180));
  const earth = { x: Math.cos(L_e), y: Math.sin(L_e) };
  const dx = planet.x - earth.x;
  const dy = planet.y - earth.y;
  return norm360((Math.atan2(dy, dx) * 180) / Math.PI);
}

/**
 * Универсальная точка входа: ГЕОЦЕНТРИЧЕСКАЯ эклиптическая долгота для
 * любого из 7 управителей. Возвращает 0..360°. Используется как HUE
 * в OKLCH и для зодиак-метки в индикаторе.
 *
 * Все тела геоцентрические — единый frame, метки зодиака корректны.
 * Раньше планеты считались гелиоцентрически, что иногда давало неверный
 * знак (например, Venus сегодня helio 135° → «Лев», geo 88° → Близнецы).
 */
export function planetEclipticLongitude(name: PlanetName, jd: number): number {
  switch (name) {
    case 'Sun':
      return sunLongitude(jd);
    case 'Moon':
      return moonLongitude(jd);
    case 'Mercury':
    case 'Venus':
    case 'Mars':
    case 'Jupiter':
    case 'Saturn':
      return planetGeoLongitude(name, jd);
  }
}

/** Знак Зодиака по долготе (для индикатора в шапке). */
const ZODIAC_RU = [
  'Овен', 'Телец', 'Близнецы', 'Рак', 'Лев', 'Дева',
  'Весы', 'Скорпион', 'Стрелец', 'Козерог', 'Водолей', 'Рыбы',
];

export function zodiacSign(longitude: number): string {
  const idx = Math.floor(norm360(longitude) / 30);
  return ZODIAC_RU[idx];
}
