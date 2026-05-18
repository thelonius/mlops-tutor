import { useDepth } from '../../hooks/useDepth';
import type { Mode } from '../../types';

const DEPTH_MODES: { mode: Mode; label: string }[] = [
  { mode: 'learn', label: 'Объяснение' },
  { mode: 'quiz', label: 'Квиз' },
  { mode: 'mock', label: 'Mock' },
];

function depthColor(count: number): string {
  if (count === 0) return 'var(--text-dimmer)';
  if (count < 4) return '#f59e0b';
  if (count < 10) return '#f97316';
  return '#22c55e';
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
