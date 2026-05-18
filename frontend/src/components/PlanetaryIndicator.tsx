import { useEffect, useState } from 'react';
import { PLANET_GLYPHS, PLANET_NAMES_RU } from '../lib/astroColors';
import type { AstroThemeState } from '../lib/themeEngine';

// Мелкий индикатор «☽ Луна · ☿ Меркурий» в шапке. День + текущий
// планетарный час. Подписка на CustomEvent('astro-theme-change') от
// useAstroTheme — обновляется в момент смены часа.
//
// На hover — подсказка с временем восхода/заката и временем когда
// сменится текущий час.
export function PlanetaryIndicator() {
  const [state, setState] = useState<AstroThemeState | null>(
    () => window.__astroTheme?.state ?? null,
  );

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<AstroThemeState>).detail;
      if (detail) setState(detail);
    };
    window.addEventListener('astro-theme-change', onChange);
    return () => window.removeEventListener('astro-theme-change', onChange);
  }, []);

  if (!state) return null;

  const { hour } = state;
  const dayGlyph = PLANET_GLYPHS[hour.dayRuler];
  const hourGlyph = PLANET_GLYPHS[hour.ruler];
  const hourEnd = new Date(hour.phaseEndTs).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const sunrise = new Date(
    new Date(hour.phaseStartTs).setHours(0, 0, 0, 0) + hour.solar.sunriseMin * 60000,
  ).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const sunset = new Date(
    new Date(hour.phaseStartTs).setHours(0, 0, 0, 0) + hour.solar.sunsetMin * 60000,
  ).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  const title =
    `День ${PLANET_NAMES_RU[hour.dayRuler]} · Час ${PLANET_NAMES_RU[hour.ruler]}\n` +
    `Восход ${sunrise} · Закат ${sunset}\n` +
    `Следующая смена часа: ${hourEnd}`;

  return (
    <span
      className="planetary-indicator"
      title={title}
      aria-label={title}
      style={{
        fontFamily: 'serif',
        fontSize: 14,
        color: 'var(--color-text-muted)',
        letterSpacing: '0.05em',
      }}
    >
      <span style={{ color: 'var(--color-text-muted)' }}>{dayGlyph}</span>
      {' · '}
      <span style={{ color: 'var(--color-accent)' }}>{hourGlyph}</span>
    </span>
  );
}
