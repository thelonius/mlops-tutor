import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../../state/store';
import { useChatStream } from '../../hooks/useChatStream';
import { Bubble } from './Bubble';
import { BubbleActions } from './BubbleActions';
import { ChatActionsProvider } from './ChatActionsContext';
import type { Message } from '../../types';

export function MessageList() {
  const { state } = useStore();
  const { messages, streaming, thinking, mode, topic, preferredModel } = state;
  const { send } = useChatStream();
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

  const sendQuick = useCallback(
    (msg: string) => {
      if (!topic || streaming) return;
      void send({
        userMessage: { role: 'user', content: msg },
        historyBefore: messages,
        topicId: topic,
        mode,
        model: preferredModel,
      });
    },
    [topic, streaming, messages, mode, preferredModel, send],
  );

  const onExplainCode = useCallback(
    (code: string) => {
      const trimmed = code.replace(/\n$/, '');
      sendQuick(
        `Разбери эту команду/конфиг построчно — объясни каждую часть простыми словами:\n\`\`\`\n${trimmed}\n\`\`\``,
      );
    },
    [sendQuick],
  );

  const actionsValue = useMemo(() => ({ onExplainCode }), [onExplainCode]);

  return (
    <ChatActionsProvider value={actionsValue}>
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
          if (isAutoTrigger(i, m)) return null;
          const isLast = i === messages.length - 1;
          const typing = streaming && isLast && m.role === 'assistant';
          const showActions =
            m.role === 'assistant' && m.content !== '' && !(streaming && isLast);
          return (
            <div key={i}>
              <Bubble role={m.role} content={m.content} typing={typing && m.content === ''} />
              {showActions && (
                <BubbleActions
                  text={m.content}
                  showNext={isLast && (mode === 'learn' || mode === 'quiz' || mode === 'mock')}
                  nextMode={mode}
                  onNext={() => sendQuick(mode === 'learn' ? 'Далее.' : 'Следующий вопрос.')}
                />
              )}
            </div>
          );
        })
      )}
      {streaming && thinking && (
        <div className="thinking-preview" style={{ marginLeft: 56 }}>
          {thinking}
        </div>
      )}
    </div>
    </ChatActionsProvider>
  );
}

function isAutoTrigger(i: number, m: Message): boolean {
  return (
    i === 0 &&
    m.role === 'user' &&
    (m.content.startsWith('Начнём') || m.content.startsWith('Объясни тему'))
  );
}
