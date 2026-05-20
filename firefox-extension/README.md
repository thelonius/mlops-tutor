# Astro Palette New Tab — Firefox extension

Новая вкладка в Firefox с той же планетарно-часовой OKLCH-палитрой, что и
основной фронт mlops-tutor, плюс блок с фазой Луны и знаком зодиака.

## Что внутри

- **Часы** — крупно, локальное время.
- **Планетарный контекст** — день недели, управитель дня, управитель часа
  (chaldean order, sunrise→sunset разбит на 12 неравных часов).
- **Палитра** — 8 свотчей: bg, surface, text, text-muted, accent, border,
  success, warn. Клик копирует OKLCH-значение в буфер.
- **Блок Луны** — фаза (эмодзи + название), процент освещённости,
  знак Зодиака по геоцентрической долготе.

Hue для accent берётся от управителя часа, hue для bg/surface/text — от
управителя дня. Долготы геоцентрические (Meeus + JPL mean elements),
поэтому палитра уникальна каждый день, без таблиц и без сети.

## Установка (dev / temporary)

1. Открой `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on…** → выбери `manifest.json` в этой папке.
3. Открой новую вкладку.

Temporary add-on живёт до перезапуска браузера.

## Постоянная установка

Подписать пакет через [AMM (addons.mozilla.org)](https://addons.mozilla.org/developers/)
или включить `xpinstall.signatures.required = false` в Firefox Developer
Edition / Nightly / ESR и зазиповать содержимое папки в `.xpi`:

```sh
cd firefox-extension && zip -r ../astro-newtab.xpi . -x README.md
```

Затем `about:addons` → шестерёнка → Install Add-on From File.

## Файлы

- [manifest.json](manifest.json) — MV3, `chrome_url_overrides.newtab`.
- [newtab.html](newtab.html) — минимальная разметка.
- [newtab.css](newtab.css) — палитровые токены + лейаут.
- [newtab.js](newtab.js) — порт `frontend/src/lib/{themeEngine,ephemerides,astroColors}.ts`
  в один self-contained файл. Без сборки, без зависимостей.
- [icons/icon.svg](icons/icon.svg) — иконка.

## Соответствие основному фронту

| Концепция            | Источник в репо                                         |
|----------------------|---------------------------------------------------------|
| `computePalette`     | `frontend/src/lib/themeEngine.ts:92`                    |
| `getPlanetaryHour`   | `frontend/src/lib/themeEngine.ts:184`                   |
| `moonLongitude`      | `frontend/src/lib/ephemerides.ts:56`                    |
| `planetGeoLongitude` | `frontend/src/lib/ephemerides.ts:150`                   |
| Coords из TZ         | `frontend/src/lib/timezoneCoords.ts`                    |
| Chaldean order       | `frontend/src/lib/astroColors.ts:43`                    |

Аспектная модуляция (`aspects.ts`, ±chroma/L) намеренно опущена —
эффект ≤2%, отдельная сложность не оправдана для статичной вкладки.
