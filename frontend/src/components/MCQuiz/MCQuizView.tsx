import { useCallback, useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import type { CheatsheetItem, Mode } from '../../types';

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function scoreLabel(score: number, total: number): string {
  if (score === total) return 'Идеально! Тема отработана.';
  if (score >= total * 0.8) return 'Отлично! Остались мелкие пробелы.';
  if (score >= total * 0.6) return 'Неплохо, но стоит повторить.';
  return 'Нужно ещё поработать над темой.';
}

export function MCQuizView() {
  const { state, dispatch } = useStore();
  const { topic, topics } = state;

  // Сессия квиза: nonce инкрементируется при «Пройти заново» — пересоздаёт
  // перетасованные пары и сбрасывает state ребёнком.
  const [nonce, setNonce] = useState(0);
  const restart = useCallback(() => setNonce((n) => n + 1), []);
  const switchMode = useCallback(
    (m: Mode) => dispatch({ type: 'SET_MODE', mode: m, messages: [] }),
    [dispatch],
  );

  if (!topic) {
    return (
      <div id="mcquiz-view" style={{ display: 'flex', flex: 1, padding: 24 }}>
        <div className="welcome">
          <h2>Тест</h2>
          <p>Выбери тему слева — соберу из чит-шита тест с 4 вариантами ответа.</p>
        </div>
      </div>
    );
  }

  const t = topics[topic];
  if (!t) return null;

  if (!Array.isArray(t.cheatsheet) || t.cheatsheet.length < 4) {
    return (
      <div id="mcquiz-view" style={{ display: 'flex', flex: 1, padding: 24 }}>
        <div className="welcome">
          <h2>Тест недоступен</h2>
          <p>Для теста нужно хотя бы 4 карточки в чит-шите этой темы.</p>
        </div>
      </div>
    );
  }

  const color = t.track === 'ml' ? '#22c55e' : '#a78bfa';

  return (
    <Quiz
      key={`${topic}|${nonce}`}
      pairs={t.cheatsheet}
      color={color}
      onRestart={restart}
      onSwitchToCheatsheet={() => switchMode('cheatsheet')}
    />
  );
}

interface QuizProps {
  pairs: CheatsheetItem[];
  color: string;
  onRestart: () => void;
  onSwitchToCheatsheet: () => void;
}

function Quiz({ pairs, color, onRestart, onSwitchToCheatsheet }: QuizProps) {
  const session = useMemo(() => shuffled(pairs), [pairs]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  // Опции считаем для текущего вопроса всегда — даже на финальном экране,
  // чтобы порядок хуков был стабильным. Невалидный idx (за пределами session)
  // даст пустой массив, отрисованный финальный экран его не использует.
  const currentPair = session[idx];
  const options = useMemo(() => {
    if (!currentPair) return [];
    const wrong = shuffled(session.filter((_, i) => i !== idx))
      .slice(0, 3)
      .map((p) => p.a);
    return shuffled([currentPair.a, ...wrong]);
  }, [session, idx, currentPair]);

  if (idx >= session.length) {
    const emoji = score === session.length ? '🏆' : score >= session.length * 0.7 ? '💪' : '📚';
    return (
      <div id="mcquiz-view" style={{ display: 'flex', flex: 1, overflowY: 'auto' }}>
        <div className="mc-wrap">
          <div className="mc-score">
            <div style={{ fontSize: 48 }}>{emoji}</div>
            <div className="mc-score-num" style={{ color }}>
              {score}/{session.length}
            </div>
            <div className="mc-score-label">{scoreLabel(score, session.length)}</div>
            <button
              type="button"
              className="mc-restart-btn"
              style={{ background: color }}
              onClick={onRestart}
            >
              Пройти заново
            </button>
            <button
              type="button"
              className="mc-restart-btn"
              style={{
                background: 'var(--bg-panel)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
              onClick={onSwitchToCheatsheet}
            >
              Открыть чит-шит
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pair = currentPair!;
  const pct = Math.round((idx / session.length) * 100);

  const onPick = (opt: string) => {
    if (picked !== null) return;
    setPicked(opt);
    if (opt === pair.a) setScore((s) => s + 1);
  };

  const next = () => {
    setIdx((i) => i + 1);
    setPicked(null);
  };

  return (
    <div id="mcquiz-view" style={{ display: 'flex', flex: 1, overflowY: 'auto' }}>
      <div className="mc-wrap">
        <div className="mc-progress">
          <span>
            {idx + 1} / {session.length}
          </span>
          <span style={{ color }}>{score} правильных</span>
        </div>
        <div className="mc-progress-bar">
          <div
            className="mc-progress-bar-fill"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
        <div className="mc-question" style={{ color }}>
          {pair.q}
        </div>
        <div className="mc-options">
          {options.map((opt) => {
            let cls = 'mc-btn';
            if (picked !== null) {
              if (opt === pair.a) cls += ' correct';
              else if (opt === picked) cls += ' wrong';
            }
            return (
              <button
                key={opt}
                type="button"
                className={cls}
                disabled={picked !== null}
                onClick={() => onPick(opt)}
              >
                {opt}
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <>
            <div className="mc-explain" style={{ display: 'block' }}>
              {pair.a}
            </div>
            <button
              type="button"
              className="mc-next-btn"
              style={{ display: 'block', background: color }}
              onClick={next}
            >
              Следующий →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
