import { useStore } from '../../state/store';

// Phase 5 stub. Полная реализация включает TTS (edge-tts через /api/tts),
// LLM-перепись текста перед TTS, секционирование и lectureRunId-инвалидацию.
// Пока показываем заглушку и предлагаем переключиться в Объяснение.
export function LectureView() {
  const { state, dispatch } = useStore();
  const { topic, topics } = state;
  if (!topic || !topics[topic]) {
    return (
      <div className="messages" style={{ padding: 24 }}>
        <div className="welcome">
          <h2>Лекция</h2>
          <p>Выбери тему слева.</p>
        </div>
      </div>
    );
  }
  const t = topics[topic];
  return (
    <div className="messages" style={{ padding: 24 }}>
      <div className="welcome">
        <h2>🎧 Лекция: {t.title}</h2>
        <p style={{ marginBottom: 12 }}>
          Озвучка переезжает на v2 в Phase 5 — там будет тот же TTS-пайплайн,
          что и в продовой версии (edge-tts + LLM-перепись).
        </p>
        <button
          type="button"
          className="mode-btn"
          style={{ width: 'auto', marginTop: 12 }}
          onClick={() => dispatch({ type: 'SET_MODE', mode: 'learn', messages: [] })}
        >
          📖 Перейти к Объяснению
        </button>
      </div>
    </div>
  );
}
