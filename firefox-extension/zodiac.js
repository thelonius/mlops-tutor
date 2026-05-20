/* zodiac.js — колесо зодиака, порт компонента ZodiacWheel/ZodiacCircle.tsx
 * из adaptive-astro-scheduler (ветка fix/lint-chartrotation, самая свежая) в
 * buildless-vanilla SVG.
 *
 * Сохранено 1:1: геометрия (longitudeToAngle / polarToCartesian), элементные
 * цвета секторов (огонь/земля/воздух/вода), градусные риски, разделители,
 * кастомные SVG-иконки знаков. Кольцо/фон берут наши палитра-токены
 * (--color-border / --color-bg / --color-text), элементные акценты — как в
 * оригинале. Сверху добавлены наши планетные маркеры и подсветка знака Луны.
 *
 * Внутренний холст viewBox 400×400 (как в оригинале, где size≈px), масштаб
 * до контейнера — через CSS (svg width/height 100%).
 */

const SIZE = 400;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER = SIZE * 0.46;
const INNER = SIZE * 0.38;
const SIGN_R = SIZE * 0.42;
const DEG_OUTER = SIZE * 0.48;
const DEG_INNER = SIZE * 0.46;
const PLANET_R = INNER * 0.84;

const SIGNS = [
  { name: 'Овен', angle: 0 }, { name: 'Телец', angle: 30 },
  { name: 'Близнецы', angle: 60 }, { name: 'Рак', angle: 90 },
  { name: 'Лев', angle: 120 }, { name: 'Дева', angle: 150 },
  { name: 'Весы', angle: 180 }, { name: 'Скорпион', angle: 210 },
  { name: 'Стрелец', angle: 240 }, { name: 'Козерог', angle: 270 },
  { name: 'Водолей', angle: 300 }, { name: 'Рыбы', angle: 330 },
];

// Кастомные пути иконок знаков (viewBox 0 0 24 24, stroke) — из ZodiacIcon.tsx.
const ICON_PATHS = {
  'Овен': 'M6 12C6 8 9 5 12 5C15 5 18 8 18 12M6 12C6 16 9 19 12 19M18 12C18 16 15 19 12 19M4 10L8 6M20 10L16 6',
  'Телец': 'M12 4C8 4 5 7 5 11C5 15 8 18 12 18C16 18 19 15 19 11C19 7 16 4 12 4ZM8 8L6 6M16 8L18 6M12 18V22',
  'Близнецы': 'M8 4V20M16 4V20M5 8H11M13 8H19M5 16H11M13 16H19',
  'Рак': 'M6 8C6 6 8 4 10 4C12 4 12 6 12 8C12 6 12 4 14 4C16 4 18 6 18 8M6 16C6 18 8 20 10 20C12 20 12 18 12 16C12 18 12 20 14 20C16 20 18 18 18 16M6 8C4 8 4 10 4 12C4 14 4 16 6 16M18 8C20 8 20 10 20 12C20 14 20 16 18 16',
  'Лев': 'M6 6C6 4 8 2 12 2C16 2 18 4 18 6C18 8 16 10 12 10C8 10 6 8 6 6ZM12 10V18M12 18C12 20 14 22 16 22M16 18C18 18 20 20 20 22',
  'Дева': 'M4 20V8C4 6 6 4 8 4C10 4 12 6 12 8V16M12 8C12 6 14 4 16 4C18 4 20 6 20 8V16M20 16C20 18 18 20 16 20C14 20 14 18 16 18C18 18 20 16 20 16',
  'Весы': 'M4 14H20M7 14C7 12 9 10 12 10C15 10 17 12 17 14M4 18C4 16 6 14 8 14C10 14 12 16 12 18C12 16 14 14 16 14C18 14 20 16 20 18M12 6V10',
  'Скорпион': 'M4 20V8C4 6 6 4 8 4C10 4 12 6 12 8V16M12 8C12 6 14 4 16 4C18 4 20 6 20 8V16M20 16L22 14M20 16L22 18M20 16H18',
  'Стрелец': 'M6 18L18 6M15 4H20V9M12 12L14 10M10 14L12 12',
  'Козерог': 'M4 16C4 12 7 8 12 8C17 8 20 12 20 16M20 16C20 18 18 20 16 20C14 20 12 18 12 16M16 20C18 20 20 22 20 22M4 8L6 6',
  'Водолей': 'M2 10C4 8 6 12 8 10C10 8 12 12 14 10C16 8 18 12 20 10C22 8 24 12 26 10M2 14C4 12 6 16 8 14C10 12 12 16 14 14C16 12 18 16 20 14C22 12 24 16 26 14',
  'Рыбы': 'M8 4C6 4 4 6 4 8C4 10 6 12 8 12C6 12 4 14 4 16C4 18 6 20 8 20M16 4C18 4 20 6 20 8C20 10 18 12 16 12C18 12 20 14 20 16C20 18 18 20 16 20M4 12H20',
};

// Элементная стихия → цвет фона сектора (rgba) и неоновый цвет иконки (hex).
function elementOf(name) {
  if (['Овен', 'Лев', 'Стрелец'].includes(name)) return { bg: 'rgba(224,17,95,0.15)', hex: '#ff3366' };   // огонь
  if (['Телец', 'Дева', 'Козерог'].includes(name)) return { bg: 'rgba(80,200,120,0.15)', hex: '#00ff66' }; // земля
  if (['Близнецы', 'Весы', 'Водолей'].includes(name)) return { bg: 'rgba(255,200,124,0.15)', hex: '#00ffff' }; // воздух
  return { bg: 'rgba(15,82,186,0.15)', hex: '#bc13fe' }; // вода
}

// Геометрия из utils.ts (1:1).
function longitudeToAngle(lon, rot = 0) {
  const a = (270 - lon + rot) % 360;
  return a >= 0 ? a : a + 360;
}
function polar(r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}
const f = n => n.toFixed(2);

/**
 * @param {{planets:{name:string,glyph:string,lon:number,isRuler:boolean}[], moonSign:number}} data
 * @returns {string} SVG-разметка колеса
 */
export function buildZodiacWheelSVG(data) {
  const ring = 'var(--color-border)';
  const bg = 'var(--color-bg)';
  const text = 'var(--color-text)';
  const degMark = 'var(--color-text-muted)';
  const accent = 'var(--color-accent)';

  let s = `<svg viewBox="0 0 ${SIZE} ${SIZE}" preserveAspectRatio="xMidYMid meet">`;

  // Фоновые круги
  s += `<circle cx="${CX}" cy="${CY}" r="${OUTER}" fill="${ring}" opacity="0.3"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="${INNER}" fill="${bg}" opacity="0.5"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="${OUTER}" fill="none" stroke="${ring}" stroke-width="2"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="${INNER}" fill="none" stroke="${ring}" stroke-width="1"/>`;

  // Элементные секторы
  for (const sign of SIGNS) {
    const a0 = longitudeToAngle(sign.angle);
    const a1 = longitudeToAngle(sign.angle + 30);
    const [ox0, oy0] = polar(OUTER, a0);
    const [ox1, oy1] = polar(OUTER, a1);
    const [ix0, iy0] = polar(INNER, a0);
    const [ix1, iy1] = polar(INNER, a1);
    const d = `M ${f(ox0)} ${f(oy0)} A ${OUTER} ${OUTER} 0 0 0 ${f(ox1)} ${f(oy1)} ` +
              `L ${f(ix1)} ${f(iy1)} A ${INNER} ${INNER} 0 0 1 ${f(ix0)} ${f(iy0)} Z`;
    const el = elementOf(sign.name);
    s += `<path d="${d}" fill="${el.bg}" stroke="${ring}" stroke-width="1"/>`;
  }

  // Подсветка знака Луны поверх элементного фона
  if (Number.isInteger(data.moonSign)) {
    const base = data.moonSign * 30;
    const a0 = longitudeToAngle(base);
    const a1 = longitudeToAngle(base + 30);
    const [ox0, oy0] = polar(OUTER, a0);
    const [ox1, oy1] = polar(OUTER, a1);
    const [ix0, iy0] = polar(INNER, a0);
    const [ix1, iy1] = polar(INNER, a1);
    const d = `M ${f(ox0)} ${f(oy0)} A ${OUTER} ${OUTER} 0 0 0 ${f(ox1)} ${f(oy1)} ` +
              `L ${f(ix1)} ${f(iy1)} A ${INNER} ${INNER} 0 0 1 ${f(ix0)} ${f(iy0)} Z`;
    s += `<path d="${d}" fill="color-mix(in oklch, ${accent} 22%, transparent)" stroke="${accent}" stroke-width="1.5"/>`;
  }

  // Градусные риски (каждый 1°, мажорные на границах знаков)
  for (let deg = 0; deg < 360; deg += 1) {
    const ang = longitudeToAngle(deg);
    const [x1, y1] = polar(DEG_INNER, ang);
    const [x2, y2] = polar(DEG_OUTER, ang);
    const major = deg % 30 === 0;
    s += `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${degMark}" ` +
         `stroke-width="${major ? 2 : 0.5}" opacity="${major ? 0.6 : 0.3}"/>`;
  }

  // Разделители знаков (30°)
  for (const sign of SIGNS) {
    const ang = longitudeToAngle(sign.angle);
    const [ix, iy] = polar(INNER, ang);
    const [ox, oy] = polar(OUTER, ang);
    s += `<line x1="${f(ix)}" y1="${f(iy)}" x2="${f(ox)}" y2="${f(oy)}" stroke="${ring}" stroke-width="1.5" opacity="0.4"/>`;
  }

  // Символы знаков (фоновый кружок + кастомная иконка)
  const symBgR = SIZE * 0.03;
  const iconSize = SIZE * 0.05;
  for (const sign of SIGNS) {
    const ang = longitudeToAngle(sign.angle);
    const [x, y] = polar(SIGN_R, ang);
    const el = elementOf(sign.name);
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="${symBgR}" fill="${bg}" stroke="${text}" stroke-width="1" opacity="0.8"/>`;
    s += `<svg x="${f(x - iconSize / 2)}" y="${f(y - iconSize / 2)}" width="${iconSize}" height="${iconSize}" ` +
         `viewBox="0 0 24 24" fill="none" stroke="${el.hex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
         `<path d="${ICON_PATHS[sign.name]}"/></svg>`;
  }

  // Планетные маркеры (наши) на реальных долготах
  for (const p of data.planets || []) {
    const ang = longitudeToAngle(p.lon);
    const [x, y] = polar(PLANET_R, ang);
    const fill = p.isRuler ? accent : text;
    const fs = p.isRuler ? 19 : 15;
    const fw = p.isRuler ? 700 : 400;
    s += `<text x="${f(x)}" y="${f(y + fs * 0.35)}" text-anchor="middle" ` +
         `font-size="${fs}" font-weight="${fw}" fill="${fill}">${p.glyph}</text>`;
  }

  // Центр
  s += `<circle cx="${CX}" cy="${CY}" r="3" fill="${text}" opacity="0.5"/>`;
  s += `</svg>`;
  return s;
}
