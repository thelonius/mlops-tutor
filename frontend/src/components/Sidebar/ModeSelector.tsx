import { useStore } from '../../state/store';
import type { Depth, Mode } from '../../types';
import { loadHistory } from '../../state/persistence';

const MODES: { id: Mode; label: string; icon: string }[] = [
  { id: 'learn', label: 'Объяснение', icon: '📖' },
  { id: 'quiz', label: 'Квиз', icon: '🧠' },
  { id: 'mock', label: 'Mock Interview', icon: '🎯' },
  { id: 'cheatsheet', label: 'Чит-шит', icon: '📋' },
  { id: 'mcquiz', label: 'Тест', icon: '🎯' },
  { id: 'lecture', label: 'Лекция', icon: '🎧' },
];

const DEPTHS: { id: Depth; label: string; icon: string; hint: string }[] = [
  { id: 'basic', label: 'Базовая', icon: '🌱', hint: 'Компактно, один концепт за раз, до 300 слов' },
  { id: 'senior', label: 'Senior', icon: '🧗', hint: 'Глубже: trade-offs, внутренности, failure modes, до 500 слов' },
];

export function ModeSelector() {
  const { state, dispatch } = useStore();
  const { mode, topic, depth, topics } = state;

  // На треке math квиз — это устный коллоквиум, а mock — устный экзамен по билету.
  // Подменяем ярлыки, поведение промптов уже разведено по subject='math' на бэке.
  const isMath = topic ? topics[topic]?.track === 'math' : false;
  const label = (m: { id: Mode; label: string }): string => {
    if (!isMath) return m.label;
    if (m.id === 'quiz') return 'Коллоквиум';
    if (m.id === 'mock') return 'Устный экзамен';
    return m.label;
  };

  const onClick = (nextMode: Mode) => {
    // При смене режима подгружаем историю для текущего топика, если она есть.
    // Иначе оставляем пустой массив — auto-start подхватит в Phase 3.
    const msgs = topic ? loadHistory(topic, nextMode) ?? [] : [];
    dispatch({ type: 'SET_MODE', mode: nextMode, messages: msgs });
  };

  return (
    <div className="mode-section">
      <div className="section-label">Режим</div>
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`mode-btn${mode === m.id ? ' active' : ''}`}
          onClick={() => onClick(m.id)}
        >
          <span className="mode-icon">{m.icon}</span> {label(m)}
        </button>
      ))}

      {mode === 'learn' && (
        <>
          <div className="section-label" style={{ marginTop: 10 }}>Глубина</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {DEPTHS.map((d) => (
              <button
                key={d.id}
                type="button"
                title={d.hint}
                className={`mode-btn${depth === d.id ? ' active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => dispatch({ type: 'SET_DEPTH', depth: d.id })}
              >
                <span className="mode-icon">{d.icon}</span> {d.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
