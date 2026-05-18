import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { useTts, type TtsState } from '../../hooks/useTts';
import { Bubble } from '../Chat/Bubble';

interface Section {
  title: string;
  body: string;
}

interface LectureResponse {
  sections?: Section[];
  error?: string;
}

// Lecture-режим: /api/lecture отдаёт секции (title + body), мы рендерим их
// как обычные ai-бабблы и автоматически проигрываем TTS по цепочке.
// Race-safety: при размонтировании или смене темы прерываем fetch и аудио
// через abort-сигнал и ref-флаг.
export function LectureView() {
  const { state } = useStore();
  const { topic, topics } = state;
  const [sections, setSections] = useState<Section[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const tts = useTts();
  const cancelledRef = useRef(false);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Загружаем секции при смене темы; гасим всё при размонтировании.
  useEffect(() => {
    if (!topic) return;
    cancelledRef.current = false;
    setStatus('loading');
    setSections(null);
    setActiveIdx(-1);
    setError(null);
    const ctrl = new AbortController();

    void (async () => {
      try {
        const res = await fetch('/api/lecture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic_id: topic }),
          signal: ctrl.signal,
        });
        const data = (await res.json()) as LectureResponse;
        if (cancelledRef.current) return;
        if (!res.ok || !Array.isArray(data.sections) || data.sections.length === 0) {
          setError(data.error || 'Пустой ответ');
          setStatus('error');
          return;
        }
        setSections(data.sections);
        setStatus('ready');
      } catch (e) {
        if (cancelledRef.current) return;
        if ((e as Error).name === 'AbortError') return;
        setError((e as Error).message);
        setStatus('error');
      }
    })();

    return () => {
      cancelledRef.current = true;
      ctrl.abort();
      tts.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  // Авто-цепочка проигрывания: когда activeIdx меняется, скроллим к секции и
  // запускаем speak с onComplete → следующая. Прелоадим следующую за ней.
  useEffect(() => {
    if (status !== 'ready' || !sections) return;
    if (activeIdx < 0 || activeIdx >= sections.length) return;

    const s = sections[activeIdx];
    const md = `### ${activeIdx + 1}. ${s.title}\n\n${s.body}`;
    sectionRefs.current[activeIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    void tts.speak(md, {
      onComplete: () => {
        if (cancelledRef.current) return;
        setActiveIdx((i) => (i + 1 < sections.length ? i + 1 : -1));
      },
    });

    const next = sections[activeIdx + 1];
    if (next) {
      const nextMd = `### ${activeIdx + 2}. ${next.title}\n\n${next.body}`;
      tts.preload(nextMd);
    }
    // tts.speak/preload/reset stable — eslint exhaustive-deps хочет их в deps,
    // но это привело бы к лишним speak'ам.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, status, sections]);

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
    <div className="messages" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      <div className="chat-header" style={{ position: 'sticky', top: 0, background: 'var(--bg)' }}>
        <span className="header-topic">🎧 {t.title}</span>
        {status === 'loading' && <em style={{ color: 'var(--text-muted)' }}>Готовлю аудио-лекцию…</em>}
        {status === 'error' && <em style={{ color: '#ef4444' }}>Не удалось: {error}</em>}
        {status === 'ready' && activeIdx === -1 && (
          <button
            type="button"
            className="mode-btn"
            style={{ width: 'auto' }}
            onClick={() => setActiveIdx(0)}
          >
            ▶ Запустить лекцию
          </button>
        )}
        {status === 'ready' && activeIdx >= 0 && (
          <TtsControls ttsState={tts.state} onToggle={tts.toggle} onStop={() => {
            tts.reset();
            setActiveIdx(-1);
          }} />
        )}
      </div>
      {sections?.map((s, i) => (
        <div
          key={i}
          ref={(el) => {
            sectionRefs.current[i] = el;
          }}
          style={{
            opacity: activeIdx >= 0 && i !== activeIdx ? 0.55 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          <Bubble role="assistant" content={`### ${i + 1}. ${s.title}\n\n${s.body}`} />
          <button
            type="button"
            className="tts-btn"
            style={{ marginLeft: 56, marginBottom: 12 }}
            onClick={() => setActiveIdx(i)}
            disabled={activeIdx === i && (tts.state === 'loading' || tts.state === 'playing')}
          >
            {activeIdx === i ? '▶ Текущая' : '🔊 Слушать эту'}
          </button>
        </div>
      ))}
    </div>
  );
}

function TtsControls({
  ttsState,
  onToggle,
  onStop,
}: {
  ttsState: TtsState;
  onToggle: () => void;
  onStop: () => void;
}) {
  return (
    <span style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
      <button type="button" className="mode-btn" style={{ width: 'auto' }} onClick={onToggle}>
        {ttsState === 'playing' ? '⏸ Пауза' : ttsState === 'paused' ? '▶ Продолжить' : '⏳'}
      </button>
      <button type="button" className="mode-btn" style={{ width: 'auto' }} onClick={onStop}>
        ⏹ Стоп
      </button>
    </span>
  );
}
