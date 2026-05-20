/* newtab.js — сборка новой вкладки. Движок палитры вынесен в библиотеку
 * astro-palette (vendor/astro-palette), здесь только DOM, рендер и
 * переключение фонов (колесо зодиака / 3D-Луна).
 */
import {
  computeState,
  coordsForTimezone,
  planetEclipticLongitude,
  zodiacSign,
  norm360,
  PLANET_GLYPHS,
  PLANET_NAMES_RU,
  WEEKDAY_RU,
} from './vendor/astro-palette/index.js';
import { buildZodiacWheelSVG } from './zodiac.js';
import { createMoon3D } from './moon3d.js';

const WHEEL_PLANETS = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'];

// ─── helpers ──────────────────────────────────────────────────
function getColorMode() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function fmtTime(d) {
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// HH:MM сегодня, "завтра HH:MM", "послезавтра HH:MM", иначе "+Nд HH:MM".
function fmtDayTime(d, now) {
  const startOf = (x) => {
    const c = new Date(x);
    c.setHours(0, 0, 0, 0);
    return c.getTime();
  };
  const days = Math.round((startOf(d) - startOf(now)) / 86400000);
  const hm = fmtTime(d);
  if (days <= 0) return hm;
  if (days === 1) return `завтра ${hm}`;
  if (days === 2) return `послезавтра ${hm}`;
  return `+${days}д ${hm}`;
}

function fmtPercent(x) {
  return `${Math.round(x * 100)}%`;
}

function fmtDuration(ms) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  if (totalMin < 60) return `${totalMin} мин`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return m === 0 ? `${h}ч` : `${h}ч ${m}м`;
  const d = Math.floor(h / 24);
  const hh = h % 24;
  return hh === 0 ? `${d}д` : `${d}д ${hh}ч`;
}

function applyPalette(palette) {
  const r = document.documentElement;
  for (const [k, v] of Object.entries(palette)) r.style.setProperty(k, v);
  r.style.colorScheme = getColorMode();
}

// oklch-токены палитры three.js не парсит — резолвим в rgb через браузер:
// ставим color через CSS-выражение на временный элемент и читаем computed.
const _probe = document.createElement('span');
_probe.style.display = 'none';
document.body.appendChild(_probe);
function resolveCssColor(cssExpr) {
  _probe.style.color = '';
  _probe.style.color = cssExpr;
  return getComputedStyle(_probe).color || '#cccccc';
}

// ─── фон: переключатель ───────────────────────────────────────
const BG_MODES = ['zodiac', 'moon'];
function currentBgMode() {
  const m = localStorage.getItem('bgMode');
  return BG_MODES.includes(m) ? m : 'zodiac';
}
function cycleBgMode() {
  const i = BG_MODES.indexOf(currentBgMode());
  localStorage.setItem('bgMode', BG_MODES[(i + 1) % BG_MODES.length]);
  render(new Date());
}

// Three.js-инстанс Луны держим один на всё время (GL-контекст дорог), создаём
// лениво при первом входе в moon-режим, dispose при уходе в zodiac.
let moon3d = null;
function renderMoonBg(moon) {
  const bg = document.getElementById('bg');
  if (!moon3d) {
    bg.innerHTML = '';
    const host = document.createElement('div');
    host.className = 'moon3d-host';
    bg.appendChild(host);
    moon3d = createMoon3D(host);
  }
  moon3d.update({
    illumination: moon.illumination,
    isWaxing: moon.waxing,
    // «Солнце» — цвет accent текущего часа, ambient — мягкий цвет дня.
    sunColor: resolveCssColor('color-mix(in oklch, var(--color-accent) 70%, white)'),
    ambientColor: resolveCssColor('var(--color-surface)'),
    bodyTint: resolveCssColor('color-mix(in oklch, var(--color-text) 70%, var(--color-accent))'),
  });
}
function disposeMoonBg() {
  if (moon3d) { moon3d.dispose(); moon3d = null; }
}

function renderZodiacBg(hour, moon, jd) {
  disposeMoonBg();
  const rulerSet = new Set([hour.ruler, hour.dayRuler]);
  const planets = WHEEL_PLANETS.map((name) => ({
    name,
    glyph: PLANET_GLYPHS[name],
    lon: planetEclipticLongitude(name, jd),
    isRuler: rulerSet.has(name),
  }));
  const moonSign = Math.floor(norm360(moon.moonLong) / 30);
  document.getElementById('bg').innerHTML = buildZodiacWheelSVG({ planets, moonSign });
}

// ─── текстовые блоки ──────────────────────────────────────────
function renderMoonLine(moon) {
  document.getElementById('moon-line').innerHTML =
    `${moon.emoji} Луна в ${zodiacSign(moon.moonLong)} · ${moon.name} · ` +
    `<span class="accent">${fmtPercent(moon.illumination)}</span>`;
}

function renderVocLine(voc, now) {
  const el = document.getElementById('voc-line');
  if (!voc) {
    el.className = 'ctx voc-line';
    el.textContent = '';
  } else if (voc.isCurrent) {
    el.className = 'ctx voc-line current';
    el.textContent =
      `без курса ещё ${fmtDuration(voc.endTs - now.getTime())}, ` +
      `до ${fmtDayTime(new Date(voc.endTs), now)} → ${voc.nextSign}`;
  } else {
    el.className = 'ctx voc-line';
    const lastG = PLANET_GLYPHS[voc.lastAspect.planet];
    el.textContent =
      `след. без курса ${fmtDayTime(new Date(voc.startTs), now)} → ` +
      `${fmtDayTime(new Date(voc.endTs), now)} ` +
      `(${fmtDuration(voc.endTs - voc.startTs)}, после ${voc.lastAspect.glyph} ${lastG})`;
  }
}

// ─── render ───────────────────────────────────────────────────
const COORDS = coordsForTimezone();

function render(now) {
  const st = computeState(now, COORDS[0], COORDS[1], { mode: getColorMode() });
  applyPalette(st.palette);

  document.getElementById('clock').textContent = fmtTime(now);

  const { hour } = st;
  document.getElementById('hour-meta').innerHTML =
    `${WEEKDAY_RU[hour.weekday]}` +
    `<span class="sep">·</span>день <span class="accent">${PLANET_GLYPHS[hour.dayRuler]} ${PLANET_NAMES_RU[hour.dayRuler]}</span>` +
    `<span class="sep">·</span>час <span class="accent">${PLANET_GLYPHS[hour.ruler]} ${PLANET_NAMES_RU[hour.ruler]}</span>`;

  renderMoonLine(st.moon);
  renderVocLine(st.voc, now);

  const mb = currentBgMode();
  document.body.classList.toggle('bg-moon', mb === 'moon');
  document.body.classList.toggle('bg-zodiac', mb === 'zodiac');
  if (mb === 'moon') renderMoonBg(st.moon);
  else renderZodiacBg(hour, st.moon, st.jd);
}

function loop() {
  render(new Date());
}

loop();
setInterval(loop, 30 * 1000);

document.getElementById('bg-toggle').addEventListener('click', cycleBgMode);
window.addEventListener('keydown', (e) => {
  if (e.key === 'b' || e.key === 'и') cycleBgMode();
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', loop);
