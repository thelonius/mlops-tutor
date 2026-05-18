import { useStore } from './state/store';
import type { Mode } from './types';

const MODES: { id: Mode; label: string; icon: string }[] = [
  { id: 'learn', label: 'Объяснение', icon: '📖' },
  { id: 'quiz', label: 'Квиз', icon: '🧠' },
  { id: 'mock', label: 'Mock Interview', icon: '🎯' },
  { id: 'cheatsheet', label: 'Чит-шит', icon: '📋' },
  { id: 'mcquiz', label: 'Тест', icon: '🎯' },
  { id: 'lecture', label: 'Лекция', icon: '🎧' },
];

export default function App() {
  const { state, dispatch } = useStore();
  const {
    topic,
    mode,
    messages,
    progress,
    curriculum,
    topics,
    curriculumStatus,
    curriculumError,
  } = state;

  return (
    <>
      <div className="sidebar">
        <div className="sidebar-header">
          <div>
            <h1>MLOps Tutor</h1>
            <p>v2 · Phase 1 store demo</p>
          </div>
        </div>

        <div className="mode-section">
          <div className="section-label">Режим</div>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`mode-btn${mode === m.id ? ' active' : ''}`}
              onClick={() => dispatch({ type: 'SET_MODE', mode: m.id, messages: [] })}
            >
              <span className="mode-icon">{m.icon}</span> {m.label}
            </button>
          ))}
        </div>

        <div className="curriculum" style={{ overflowY: 'auto', flex: 1, padding: '8px 12px' }}>
          {curriculumStatus === 'loading' && (
            <div style={{ color: 'var(--text-muted)' }}>Загрузка…</div>
          )}
          {curriculumStatus === 'error' && (
            <div style={{ color: '#ef4444' }}>Ошибка: {curriculumError}</div>
          )}
          {curriculumStatus === 'ready' &&
            curriculum.slice(0, 3).map((group) => (
              <div key={group.id} style={{ marginBottom: 12 }}>
                <div className="section-label">{group.title}</div>
                {group.topics.map((tid) => {
                  const t = topics[tid];
                  if (!t) return null;
                  const active = topic === tid;
                  const done = progress.has(tid);
                  return (
                    <button
                      key={tid}
                      type="button"
                      className={`mode-btn${active ? ' active' : ''}`}
                      onClick={() => dispatch({ type: 'SELECT_TOPIC', topic: tid, messages: [] })}
                    >
                      <span className="mode-icon">{done ? '✓' : t.emoji}</span> {t.title}
                    </button>
                  );
                })}
              </div>
            ))}
        </div>
      </div>

      <div className="main">
        <div className="chat-header">
          <span className="header-topic">
            {topic && topics[topic] ? topics[topic].title : 'Выбери тему →'}
          </span>
        </div>

        <div className="messages" style={{ padding: 16 }}>
          {!topic && (
            <div className="welcome">
              <h2>Phase 1 demo</h2>
              <p>
                Reducer и localStorage работают. Выбери тему, переключи режим, перезагрузи
                страницу — стейт восстановится из <code>mlops_session</code> и{' '}
                <code>mlops_chat_*</code>.
              </p>
            </div>
          )}
          {topic && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <pre
                style={{
                  background: 'var(--code-bg)',
                  border: '1px solid var(--code-border)',
                  padding: 12,
                  borderRadius: 6,
                  overflowX: 'auto',
                }}
              >
                {JSON.stringify({ topic, mode, messageCount: messages.length }, null, 2)}
              </pre>
              <button
                type="button"
                className="mode-btn"
                style={{ width: 'auto', alignSelf: 'flex-start' }}
                onClick={() =>
                  dispatch({
                    type: 'APPEND_MESSAGE',
                    message: {
                      role: 'user',
                      content: `Тестовое сообщение ${messages.length + 1}`,
                    },
                  })
                }
              >
                + добавить сообщение (проверка персистенса)
              </button>
              <button
                type="button"
                className="mode-btn"
                style={{ width: 'auto', alignSelf: 'flex-start' }}
                onClick={() => dispatch({ type: 'MARK_DONE', topic })}
              >
                Отметить тему пройденной
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
