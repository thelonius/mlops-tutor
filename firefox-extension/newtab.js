/* Astro Palette new-tab — self-contained port of frontend/src/lib/themeEngine.ts
 * + ephemerides.ts + astroColors.ts. Без сборки, без сети.
 *
 * Что считаем:
 *   1. Координаты — Intl timezone → город из таблицы. Fallback Москва.
 *   2. Sunrise/sunset (NOAA Spencer 1971) → chaldean planetary hour.
 *   3. Геоцентрическая эклиптическая долгота управителей дня и часа → hue.
 *   4. OKLCH палитра по PALETTE_SPEC, mode = prefers-color-scheme.
 *   5. Moon: долгота, фаза (sun-moon angle), illumination, zodiac.
 */

(() => {
  'use strict';

  // ─── astroColors ──────────────────────────────────────────────
  const PLANET_GLYPHS = {
    Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀',
    Mars: '♂', Jupiter: '♃', Saturn: '♄',
  };
  const PLANET_NAMES_RU = {
    Sun: 'Солнце', Moon: 'Луна', Mercury: 'Меркурий', Venus: 'Венера',
    Mars: 'Марс', Jupiter: 'Юпитер', Saturn: 'Сатурн',
  };
  const CHALDEAN_ORDER = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'];
  const WEEKDAY_RULERS = {
    0: 'Sun', 1: 'Moon', 2: 'Mars', 3: 'Mercury',
    4: 'Jupiter', 5: 'Venus', 6: 'Saturn',
  };
  const WEEKDAY_RU = [
    'воскресенье', 'понедельник', 'вторник', 'среда',
    'четверг', 'пятница', 'суббота',
  ];
  const ZODIAC_RU = [
    'Овен', 'Телец', 'Близнецы', 'Рак', 'Лев', 'Дева',
    'Весы', 'Скорпион', 'Стрелец', 'Козерог', 'Водолей', 'Рыбы',
  ];

  // ─── timezone → city ──────────────────────────────────────────
  const TZ_COORDS = {
    'Europe/Moscow': [55.75, 37.62],
    'Europe/London': [51.51, -0.13],
    'Europe/Berlin': [52.52, 13.40],
    'Europe/Paris': [48.85, 2.35],
    'Europe/Madrid': [40.42, -3.70],
    'Europe/Rome': [41.90, 12.50],
    'Europe/Amsterdam': [52.37, 4.90],
    'Europe/Brussels': [50.85, 4.35],
    'Europe/Stockholm': [59.33, 18.07],
    'Europe/Oslo': [59.91, 10.75],
    'Europe/Copenhagen': [55.68, 12.57],
    'Europe/Helsinki': [60.17, 24.94],
    'Europe/Athens': [37.98, 23.73],
    'Europe/Istanbul': [41.01, 28.98],
    'Europe/Kyiv': [50.45, 30.52],
    'Europe/Kiev': [50.45, 30.52],
    'Europe/Warsaw': [52.23, 21.01],
    'Europe/Lisbon': [38.72, -9.14],
    'Europe/Dublin': [53.35, -6.26],
    'Europe/Zurich': [47.38, 8.55],
    'Europe/Vienna': [48.21, 16.37],
    'Europe/Prague': [50.08, 14.44],
    'Europe/Bucharest': [44.43, 26.10],
    'Europe/Belgrade': [44.79, 20.45],
    'Europe/Sofia': [42.70, 23.32],
    'Europe/Minsk': [53.90, 27.57],
    'Europe/Riga': [56.95, 24.11],
    'Europe/Tallinn': [59.44, 24.75],
    'Europe/Vilnius': [54.69, 25.28],
    'America/New_York': [40.71, -74.01],
    'America/Chicago': [41.88, -87.63],
    'America/Denver': [39.74, -104.99],
    'America/Los_Angeles': [34.05, -118.24],
    'America/Phoenix': [33.45, -112.07],
    'America/Anchorage': [61.22, -149.90],
    'America/Honolulu': [21.31, -157.86],
    'America/Toronto': [43.65, -79.38],
    'America/Vancouver': [49.28, -123.12],
    'America/Mexico_City': [19.43, -99.13],
    'America/Sao_Paulo': [-23.55, -46.63],
    'America/Buenos_Aires': [-34.61, -58.38],
    'Asia/Tokyo': [35.68, 139.69],
    'Asia/Seoul': [37.57, 126.98],
    'Asia/Shanghai': [31.23, 121.47],
    'Asia/Hong_Kong': [22.32, 114.17],
    'Asia/Singapore': [1.35, 103.82],
    'Asia/Bangkok': [13.76, 100.50],
    'Asia/Jakarta': [-6.21, 106.85],
    'Asia/Kolkata': [22.57, 88.36],
    'Asia/Dubai': [25.20, 55.27],
    'Asia/Jerusalem': [31.78, 35.22],
    'Asia/Tbilisi': [41.72, 44.78],
    'Asia/Yekaterinburg': [56.84, 60.61],
    'Asia/Novosibirsk': [55.04, 82.93],
    'Africa/Cairo': [30.04, 31.24],
    'Africa/Lagos': [6.46, 3.40],
    'Africa/Johannesburg': [-26.20, 28.04],
    'Australia/Sydney': [-33.87, 151.21],
    'Australia/Melbourne': [-37.81, 144.96],
    'Pacific/Auckland': [-36.85, 174.76],
  };
  const FALLBACK_COORDS = [55.75, 37.62];

  // ─── ephemerides (port) ───────────────────────────────────────
  const J2000 = 2451545.0;
  const rad = x => (x * Math.PI) / 180;
  const norm360 = x => ((x % 360) + 360) % 360;

  function toJulianDate(d) {
    return d.getTime() / 86400000 + 2440587.5;
  }

  function sunLongitude(jd) {
    const T = (jd - J2000) / 36525;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const Mdeg = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    const M = rad(Mdeg);
    const C =
      (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) +
      (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
      0.000289 * Math.sin(3 * M);
    return norm360(L0 + C);
  }

  function moonLongitude(jd) {
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

  const SEMI_AXIS = {
    Mercury: 0.38710, Venus: 0.72333, Mars: 1.52371,
    Jupiter: 5.20289, Saturn: 9.53668,
  };
  const PLANET_ELEMENTS = {
    Mercury: { L0: 252.25032350, dL: 149472.67411175, e: 0.20563593, varpi: 77.45779628 },
    Venus:   { L0: 181.97909950, dL: 58517.81538729,  e: 0.00677672, varpi: 131.60246718 },
    Mars:    { L0: 355.43299958, dL: 19140.30268499,  e: 0.09339410, varpi: 336.04084084 },
    Jupiter: { L0: 34.39644051,  dL: 3034.74612775,   e: 0.04838624, varpi: 14.72847983 },
    Saturn:  { L0: 49.95424423,  dL: 1222.49362201,   e: 0.05386179, varpi: 92.59887831 },
  };

  function planetHelioState(name, jd) {
    const el = PLANET_ELEMENTS[name];
    const T = (jd - J2000) / 36525;
    const L = el.L0 + el.dL * T;
    const M = rad(L - el.varpi);
    const e = el.e;
    const Crad =
      (2 * e - (e * e * e) / 4) * Math.sin(M) +
      (5 / 4) * e * e * Math.sin(2 * M);
    return {
      trueLongDeg: norm360(L + (Crad * 180) / Math.PI),
      trueAnomaly: M + Crad,
      e,
      a: SEMI_AXIS[name],
    };
  }

  function helioXY(s) {
    const r = (s.a * (1 - s.e * s.e)) / (1 + s.e * Math.cos(s.trueAnomaly));
    const L = rad(s.trueLongDeg);
    return { x: r * Math.cos(L), y: r * Math.sin(L) };
  }

  function planetGeoLongitude(name, jd) {
    const p = helioXY(planetHelioState(name, jd));
    const Le = rad(norm360(sunLongitude(jd) + 180));
    const earth = { x: Math.cos(Le), y: Math.sin(Le) };
    return norm360((Math.atan2(p.y - earth.y, p.x - earth.x) * 180) / Math.PI);
  }

  function planetEclipticLongitude(name, jd) {
    if (name === 'Sun') return sunLongitude(jd);
    if (name === 'Moon') return moonLongitude(jd);
    return planetGeoLongitude(name, jd);
  }

  function zodiacSign(longitude) {
    return ZODIAC_RU[Math.floor(norm360(longitude) / 30)];
  }

  // ─── solar times / planetary hour ─────────────────────────────
  function computeSolarTimes(date, lat, lon) {
    const dayOfYear = Math.floor(
      (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
        - Date.UTC(date.getFullYear(), 0, 0)) / 86400000
    );
    const latRad = lat * Math.PI / 180;
    const B = 2 * Math.PI * (dayOfYear - 1) / 365;
    const eqOfTime = 229.18 * (
      0.000075
      + 0.001868 * Math.cos(B)
      - 0.032077 * Math.sin(B)
      - 0.014615 * Math.cos(2 * B)
      - 0.040849 * Math.sin(2 * B)
    );
    const decl = 0.006918 - 0.399912 * Math.cos(B) + 0.070257 * Math.sin(B)
      - 0.006758 * Math.cos(2 * B) + 0.000907 * Math.sin(2 * B)
      - 0.002697 * Math.cos(3 * B) + 0.00148 * Math.sin(3 * B);
    const tzOffsetMin = -date.getTimezoneOffset();
    const cosHA = (Math.cos(90.833 * Math.PI / 180) - Math.sin(latRad) * Math.sin(decl))
      / (Math.cos(latRad) * Math.cos(decl));
    const ha = Math.acos(Math.max(-1, Math.min(1, cosHA))) * 180 / Math.PI;
    const solarNoonMin = 720 - 4 * lon - eqOfTime + tzOffsetMin;
    return { sunriseMin: solarNoonMin - ha * 4, sunsetMin: solarNoonMin + ha * 4 };
  }

  function midnightTs(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function getPlanetaryHour(now, lat, lon) {
    let dayBase = new Date(now);
    let solar = computeSolarTimes(dayBase, lat, lon);
    const sunriseTsToday = midnightTs(dayBase) + solar.sunriseMin * 60000;
    if (now.getTime() < sunriseTsToday) {
      dayBase = new Date(now);
      dayBase.setDate(dayBase.getDate() - 1);
      solar = computeSolarTimes(dayBase, lat, lon);
    }
    const tomorrow = new Date(dayBase);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextSolar = computeSolarTimes(tomorrow, lat, lon);
    const sunriseTs = midnightTs(dayBase) + solar.sunriseMin * 60000;
    const sunsetTs = midnightTs(dayBase) + solar.sunsetMin * 60000;
    const nextSunriseTs = midnightTs(tomorrow) + nextSolar.sunriseMin * 60000;

    let phaseStartTs, phaseEndTs, totalIdx;
    if (now.getTime() < sunsetTs) {
      const hourLen = (sunsetTs - sunriseTs) / 12;
      const hourIdx = Math.floor((now.getTime() - sunriseTs) / hourLen);
      phaseStartTs = sunriseTs + hourIdx * hourLen;
      phaseEndTs = phaseStartTs + hourLen;
      totalIdx = hourIdx;
    } else {
      const hourLen = (nextSunriseTs - sunsetTs) / 12;
      const hourIdx = Math.floor((now.getTime() - sunsetTs) / hourLen);
      phaseStartTs = sunsetTs + hourIdx * hourLen;
      phaseEndTs = phaseStartTs + hourLen;
      totalIdx = 12 + hourIdx;
    }

    const dayRuler = WEEKDAY_RULERS[dayBase.getDay()];
    const startIdx = CHALDEAN_ORDER.indexOf(dayRuler);
    const ruler = CHALDEAN_ORDER[(startIdx + totalIdx) % 7];
    return { ruler, dayRuler, phaseStartTs, phaseEndTs, totalIdx, weekday: dayBase.getDay() };
  }

  // ─── palette ──────────────────────────────────────────────────
  const PALETTE_SPEC = {
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
  const TOKEN_NAMES = {
    bg: '--color-bg', surface: '--color-surface',
    text: '--color-text', textMuted: '--color-text-muted',
    accent: '--color-accent', border: '--color-border',
    success: '--color-success', warn: '--color-warn',
  };

  function computePalette(dayHue, hourHue, mode) {
    const spec = PALETTE_SPEC[mode];
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

  function getColorMode() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // ─── void of course ───────────────────────────────────────────
  // Классический VoC: интервал от ПОСЛЕДНЕГО точного аспекта Луны к одному
  // из 6 традиционных управителей (Sun, Mercury, Venus, Mars, Jupiter,
  // Saturn) ДО входа Луны в следующий знак Зодиака. Используются 5
  // Птолемеевых аспектов: ☌ 0°, ⚹ 60°, □ 90°, △ 120°, ☍ 180°.
  //
  // Алгоритм: forward-scan от now шагом STEP_MS до смены знака. Для каждой
  // пары (планета × угол) трекаем signed delta = signedMin(moonLong -
  // planetLong - aspect); момент когда delta меняет знак (и оба соседних
  // значения малы, чтобы исключить wrap через ±180) — точный аспект.
  // Время уточняется линейной интерполяцией.
  //
  // Если в текущем знаке аспектов в будущем НЕТ — Луна уже без курса
  // прямо сейчас, до signChangeTs.
  const VOC_PLANETS = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  const VOC_ASPECTS = [0, 60, 90, 120, 180];
  // Русские сокращения вместо астрологических глифов: ☌/☍/⚹ часто
  // отсутствуют в системных шрифтах и фоллбэк рендерит их как ♂/♀.
  const ASPECT_GLYPHS = { 0: 'соед.', 60: 'секст.', 90: 'квадр.', 120: 'тригон', 180: 'оппоз.' };

  function signedMin(x) {
    return ((x + 180) % 360 + 360) % 360 - 180;
  }

  function findVoC(now) {
    const STEP_MS = 10 * 60 * 1000;
    const MAX_MS = 3 * 24 * 60 * 60 * 1000;

    // Цели: для угла 0/180 одна ветвь, для 60/90/120 — обе (положительная и
    // отрицательная разность даёт два аспекта на полный оборот относительной
    // долготы).
    const targets = [];
    for (const p of VOC_PLANETS) {
      for (const a of VOC_ASPECTS) {
        targets.push({ planet: p, target: a, glyph: ASPECT_GLYPHS[a] });
        if (a !== 0 && a !== 180) {
          targets.push({ planet: p, target: -a, glyph: ASPECT_GLYPHS[a] });
        }
      }
    }

    const startTs = now.getTime();
    const startJD = toJulianDate(now);
    const moonStart = moonLongitude(startJD);
    const startSign = Math.floor(moonStart / 30);

    let prevTs = startTs;
    let prevDeltas = targets.map(({ planet, target }) =>
      signedMin(moonStart - planetEclipticLongitude(planet, startJD) - target)
    );

    const aspectsAhead = [];
    let signChangeTs = null;
    let prevMoon = moonStart;

    for (let dt = STEP_MS; dt <= MAX_MS; dt += STEP_MS) {
      const ts = startTs + dt;
      const jd = toJulianDate(new Date(ts));
      const moon = moonLongitude(jd);

      if (Math.floor(moon / 30) !== startSign) {
        // Bisect для точности входа в новый знак (~секунды).
        let lo = prevTs, hi = ts;
        for (let i = 0; i < 18; i++) {
          const mid = (lo + hi) / 2;
          const mLong = moonLongitude(toJulianDate(new Date(mid)));
          if (Math.floor(mLong / 30) === startSign) lo = mid;
          else hi = mid;
        }
        signChangeTs = hi;
        break;
      }

      for (let i = 0; i < targets.length; i++) {
        const { planet, target, glyph } = targets[i];
        const delta = signedMin(moon - planetEclipticLongitude(planet, jd) - target);
        if (Math.sign(prevDeltas[i]) !== Math.sign(delta) &&
            Math.abs(prevDeltas[i]) + Math.abs(delta) < 30) {
          const frac = Math.abs(prevDeltas[i]) / (Math.abs(prevDeltas[i]) + Math.abs(delta));
          const aspectTs = prevTs + (ts - prevTs) * frac;
          aspectsAhead.push({ ts: aspectTs, planet, aspect: Math.abs(target), glyph });
        }
        prevDeltas[i] = delta;
      }

      prevTs = ts;
      prevMoon = moon;
    }

    if (signChangeTs === null) return null;

    const nextSign = ZODIAC_RU[(startSign + 1) % 12];

    if (aspectsAhead.length === 0) {
      return { isCurrent: true, endTs: signChangeTs, nextSign };
    }
    aspectsAhead.sort((a, b) => a.ts - b.ts);
    const last = aspectsAhead[aspectsAhead.length - 1];
    return {
      isCurrent: false,
      startTs: last.ts,
      endTs: signChangeTs,
      lastAspect: last,
      nextSign,
    };
  }

  // ─── moon phase ───────────────────────────────────────────────
  // Angle (Moon - Sun) → 0=new, 90=first qtr, 180=full, 270=last qtr.
  function moonPhaseInfo(jd) {
    const moon = moonLongitude(jd);
    const sun = sunLongitude(jd);
    const angle = norm360(moon - sun);
    const illumination = (1 - Math.cos(rad(angle))) / 2;
    const PHASES = [
      { max: 22.5,  name: 'новолуние',           emoji: '🌑', waxing: true },
      { max: 67.5,  name: 'растущий серп',       emoji: '🌒', waxing: true },
      { max: 112.5, name: 'первая четверть',     emoji: '🌓', waxing: true },
      { max: 157.5, name: 'растущая луна',       emoji: '🌔', waxing: true },
      { max: 202.5, name: 'полнолуние',          emoji: '🌕', waxing: false },
      { max: 247.5, name: 'убывающая луна',      emoji: '🌖', waxing: false },
      { max: 292.5, name: 'последняя четверть',  emoji: '🌗', waxing: false },
      { max: 337.5, name: 'убывающий серп',      emoji: '🌘', waxing: false },
      { max: 360.1, name: 'новолуние',           emoji: '🌑', waxing: true },
    ];
    const phase = PHASES.find(p => angle < p.max);
    return { angle, illumination, name: phase.name, emoji: phase.emoji, waxing: phase.waxing, moonLong: moon };
  }

  // ─── render ───────────────────────────────────────────────────
  function getCoords() {
    let tz = null;
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
    return (tz && TZ_COORDS[tz]) || FALLBACK_COORDS;
  }

  function fmtTime(d) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  // HH:MM сегодня, "завтра HH:MM", "послезавтра HH:MM", иначе "+Nд HH:MM".
  function fmtDayTime(d, now) {
    const startOf = x => {
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

  const PALETTE_LABELS = {
    '--color-bg':         'bg',
    '--color-surface':    'surface',
    '--color-text':       'text',
    '--color-text-muted': 'muted',
    '--color-accent':     'accent',
    '--color-border':     'border',
    '--color-success':    'ok',
    '--color-warn':       'warn',
  };

  // Один полный расчёт палитры для произвольного момента — тот же путь,
  // что в render(), но без побочки: возвращает палитру + краткий контекст
  // для тултипа.
  function paletteFor(moment, lat, lon, mode) {
    const hour = getPlanetaryHour(moment, lat, lon);
    const jd = toJulianDate(moment);
    const dayHue = planetEclipticLongitude(hour.dayRuler, jd);
    const hourHue = planetEclipticLongitude(hour.ruler, jd);
    return {
      palette: computePalette(dayHue, hourHue, mode),
      dayRuler: hour.dayRuler,
      ruler: hour.ruler,
    };
  }

  function renderAdjacentRow(rowEl, label, info) {
    rowEl.innerHTML = '';
    const lab = document.createElement('div');
    lab.className = 'adj-label';
    lab.innerHTML = label;
    lab.title =
      `${PLANET_NAMES_RU[info.dayRuler]} день · ${PLANET_NAMES_RU[info.ruler]} час`;
    rowEl.appendChild(lab);
    for (const value of Object.values(info.palette)) {
      const s = document.createElement('div');
      s.className = 'adj-swatch';
      s.style.background = value;
      s.title = value;
      rowEl.appendChild(s);
    }
  }

  function renderAdjacent(now, lat, lon, mode) {
    const hour = getPlanetaryHour(now, lat, lon);
    // Момент гарантированно внутри соседнего часа: за минуту до старта
    // текущего / через минуту после его конца. Планетарный час длится
    // ~40-80 мин, минутного отступа хватает.
    const prevHour = new Date(hour.phaseStartTs - 60000);
    const nextHour = new Date(hour.phaseEndTs + 60000);
    const yest = new Date(now.getTime() - 86400000);
    const tom = new Date(now.getTime() + 86400000);

    // glyphKey: какой управитель показать в подписи. Для часовых строк это
    // ruler (он гонит accent-hue), для дневных — dayRuler (база палитры).
    const rows = [
      ['adj-prev-hour', 'пред.', prevHour, 'ruler'],
      ['adj-next-hour', 'след.', nextHour, 'ruler'],
      ['adj-yesterday', 'вчера', yest, 'dayRuler'],
      ['adj-tomorrow', 'завтра', tom, 'dayRuler'],
    ];
    for (const [id, baseLabel, moment, glyphKey] of rows) {
      const info = paletteFor(moment, lat, lon, mode);
      const glyph = PLANET_GLYPHS[info[glyphKey]];
      renderAdjacentRow(
        document.getElementById(id),
        `${baseLabel} <span class="accent">${glyph}</span>`,
        info,
      );
    }
  }

  function renderPaletteSwatches(palette) {
    const root = document.getElementById('palette');
    root.innerHTML = '';
    for (const [varName, value] of Object.entries(palette)) {
      const el = document.createElement('div');
      el.className = 'swatch';
      el.style.background = value;
      el.dataset.label = PALETTE_LABELS[varName] || varName;
      el.title = `${varName}: ${value}`;
      el.addEventListener('click', () => {
        navigator.clipboard?.writeText(value).catch(() => {});
      });
      root.appendChild(el);
    }
  }

  // SVG-путь освещённой части диска радиуса 1.
  // Терминатор — полу-эллипс с rx = |cos(phaseAngle)|. Полу-диск рисуется
  // на той стороне, где Луна освещена (waxing → правая, waning → левая),
  // плюс полу-эллипс, который её либо подрезает (crescent), либо
  // расширяет (gibbous), в зависимости от знака cos(phaseAngle).
  function moonLitPath(phase) {
    const k = phase.illumination;
    const cosT = Math.cos(rad(phase.angle));    // <0 → gibbous, >0 → crescent
    const rx = Math.abs(cosT).toFixed(4);
    const isCrescent = k < 0.5;
    if (phase.waxing) {
      // Полу-диск справа: from (0,-1) arc sweep=1 to (0,1).
      // Затем эллипс назад в (0,-1):
      //   crescent (cosT>0)  → sweep=0 (вогнутая дуга в правую половину) — подрезает
      //   gibbous  (cosT<0)  → sweep=1 (выпуклая в левую половину) — расширяет
      const sweep = isCrescent ? 0 : 1;
      return `M 0,-1 A 1,1 0 0,1 0,1 A ${rx},1 0 0,${sweep} 0,-1 Z`;
    } else {
      // Полу-диск слева.
      const sweep = isCrescent ? 1 : 0;
      return `M 0,-1 A 1,1 0 0,0 0,1 A ${rx},1 0 0,${sweep} 0,-1 Z`;
    }
  }

  function renderMoon(phase, moonLong, now) {
    document.getElementById('moon-lit').setAttribute('d', moonLitPath(phase));
    const sign = zodiacSign(moonLong);
    document.getElementById('moon-title').textContent = `Луна в знаке ${sign}`;
    document.getElementById('moon-sub').innerHTML =
      `${phase.emoji} ${phase.name} · <span class="accent">${fmtPercent(phase.illumination)}</span>`;

    const vocEl = document.getElementById('moon-voc');
    const voc = findVoC(now);
    if (!voc) {
      vocEl.className = 'moon-voc';
      vocEl.textContent = '';
      return;
    }
    if (voc.isCurrent) {
      vocEl.className = 'moon-voc current';
      const remaining = fmtDuration(voc.endTs - now.getTime());
      vocEl.textContent =
        `без курса ещё ${remaining}, до ${fmtDayTime(new Date(voc.endTs), now)} → ${voc.nextSign}`;
    } else {
      vocEl.className = 'moon-voc';
      const lastG = PLANET_GLYPHS[voc.lastAspect.planet];
      const dur = fmtDuration(voc.endTs - voc.startTs);
      vocEl.textContent =
        `след. без курса ${fmtDayTime(new Date(voc.startTs), now)} → ` +
        `${fmtDayTime(new Date(voc.endTs), now)} (${dur}, после ${voc.lastAspect.glyph} ${lastG} ${PLANET_NAMES_RU[voc.lastAspect.planet]})`;
    }
  }

  function applyPalette(palette) {
    const r = document.documentElement;
    for (const [k, v] of Object.entries(palette)) r.style.setProperty(k, v);
    r.style.colorScheme = getColorMode();
  }

  function render(now) {
    const [lat, lon] = getCoords();
    const hour = getPlanetaryHour(now, lat, lon);
    const jd = toJulianDate(now);
    const dayHue = planetEclipticLongitude(hour.dayRuler, jd);
    const hourHue = planetEclipticLongitude(hour.ruler, jd);
    const mode = getColorMode();
    const palette = computePalette(dayHue, hourHue, mode);

    applyPalette(palette);

    document.getElementById('clock').textContent = fmtTime(now);

    const dayG = PLANET_GLYPHS[hour.dayRuler];
    const dayN = PLANET_NAMES_RU[hour.dayRuler];
    const hourG = PLANET_GLYPHS[hour.ruler];
    const hourN = PLANET_NAMES_RU[hour.ruler];
    document.getElementById('hour-meta').innerHTML =
      `${WEEKDAY_RU[hour.weekday]}` +
      `<span class="sep">·</span>день <span class="accent">${dayG} ${dayN}</span>` +
      `<span class="sep">·</span>час <span class="accent">${hourG} ${hourN}</span>`;

    renderPaletteSwatches(palette);
    renderAdjacent(now, lat, lon, mode);
    renderMoon(moonPhaseInfo(jd), moonLongitude(jd), now);

    const next = new Date(hour.phaseEndTs);
    document.getElementById('foot').textContent =
      `следующий час в ${fmtTime(next)}`;
  }

  function loop() {
    render(new Date());
  }

  // Первичный пэйнт + ребилд каждую минуту (для часов и фазы часа).
  loop();
  setInterval(loop, 30 * 1000);

  // Реакция на смену OS-темы.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', loop);
})();
