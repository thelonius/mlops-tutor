import { useEffect, useRef } from 'react';
import { useStore } from '../../state/store';
import { Bubble } from './Bubble';

export function MessageList() {
  const { state } = useStore();
  const { messages, streaming, thinking } = state;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Автоскролл вниз при добавлении/росте сообщений и при стриме.
  // Если пользователь сам скроллит вверх — оставим в покое (порог 80px).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (fromBottom < 80) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, thinking]);

  return (
    <div className="messages" id="messages" ref={scrollRef}>
      {messages.length === 0 ? (
        <div className="welcome" id="welcome">
          <div className="welcome-arrow">←</div>
          <h2>Выбери тему слева</h2>
          <p>
            Начни с первой недели — Контейнеры и Docker. Каждая тема объясняется с нуля,
            с аналогиями и примерами кода.
          </p>
        </div>
      ) : (
        messages.map((m, i) => {
          // Скрываем авто-триггер первого сообщения. Совпадает с legacy
          // renderAllMessages: «Начнём тему…», «Объясни тему…».
          if (
            i === 0 &&
            m.role === 'user' &&
            (m.content.startsWith('Начнём') || m.content.startsWith('Объясни тему'))
          ) {
            return null;
          }
          const isLast = i === messages.length - 1;
          const typing = streaming && isLast && m.role === 'assistant';
          return (
            <Bubble
              key={i}
              role={m.role}
              content={m.content}
              typing={typing && m.content === ''}
            />
          );
        })
      )}
      {streaming && thinking && (
        <div className="thinking-preview" style={{ marginLeft: 56 }}>
          {thinking}
        </div>
      )}
    </div>
  );
}
