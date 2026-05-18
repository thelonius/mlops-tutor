import { useDepth } from '../../hooks/useDepth';
import type { Mode } from '../../types';

const DEPTH_MODES: { mode: Mode; label: string }[] = [
  { mode: 'learn', label: 'Объяснение' },
  { mode: 'quiz', label: 'Квиз' },
  { mode: 'mock', label: 'Mock' },
];

function depthColor(count: number): string {
  if (count === 0) return 'var(--text-dimmer)';
  // Жёлтый/оранжевый/зелёный — семантический «прогресс»: начал → в процессе →
  // проработал. Зелёный финал берём из --color-success (фикс. hue 145°,
  // L/C адаптируется к mode + aspect-модуляции).
  if (count < 4) return '#f59e0b';
  if (count < 10) return '#f97316';
  return 'var(--color-success)';
}

function Dot({ tid, mode, label }: { tid: string; mode: Mode; label: string }) {
  const count = useDepth(tid, mode);
  return (
    <span
      className="depth-dot"
      style={{ background: depthColor(count) }}
      title={`${label}: ${count} обменов`}
    />
  );
}

export function DepthDots({ tid }: { tid: string }) {
  return (
    <span className="topic-depth">
      {DEPTH_MODES.map(({ mode, label }) => (
        <Dot key={mode} tid={tid} mode={mode} label={label} />
      ))}
    </span>
  );
}
