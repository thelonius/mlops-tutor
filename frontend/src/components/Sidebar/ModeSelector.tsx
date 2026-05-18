import { useStore } from '../../state/store';
import type { Mode } from '../../types';
import { loadHistory } from '../../state/persistence';

const MODES: { id: Mode; label: string; icon: string }[] = [
  { id: 'learn', label: 'Объяснение', icon: '📖' },
  { id: 'quiz', label: 'Квиз', icon: '🧠' },
  { id: 'mock', label: 'Mock Interview', icon: '🎯' },
  { id: 'cheatsheet', label: 'Чит-шит', icon: '📋' },
  { id: 'mcquiz', label: 'Тест', icon: '🎯' },
  { id: 'lecture', label: 'Лекция', icon: '🎧' },
];

export function ModeSelector() {
  const { state, dispatch } = useStore();
  const { mode, topic } = state;

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
          <span className="mode-icon">{m.icon}</span> {m.label}
        </button>
      ))}
    </div>
  );
}
