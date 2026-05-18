import { useCallback, useRef } from 'react';
import { useStore } from '../state/store';
import type { Message, Mode } from '../types';

interface SendArgs {
  userMessage: Message;
  // История ДО userMessage. На бэкенд отдаём historyBefore + [userMessage].
  historyBefore: Message[];
  topicId: string;
  mode: Mode;
  model: string;
}

// SSE-парсер. Формат: 'data: {json}\n\n' с полями text/thinking/error
// и маркером [DONE]. См. /api/chat в app.py.
interface SseEvent {
  text?: string;
  thinking?: string;
  error?: string;
}

function* parseSseLines(buffer: string): Generator<SseEvent | '[DONE]'> {
  for (const line of buffer.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const raw = line.slice(6).trim();
    if (raw === '[DONE]') {
      yield '[DONE]';
      continue;
    }
    try {
      yield JSON.parse(raw) as SseEvent;
    } catch {
      // битый JSON — игнорируем, как и в legacy
    }
  }
}

export function useChatStream() {
  const { dispatch } = useStore();
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async ({ userMessage, historyBefore, topicId, mode, model }: SendArgs) => {
      // Отменяем предыдущий стрим если он ещё в полёте.
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      dispatch({ type: 'STREAM_START', userMessage });

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...historyBefore, userMessage],
            topic_id: topicId,
            mode,
            model,
          }),
          signal: ctrl.signal,
        });

        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const body = (await res.json()) as { error?: string };
            if (body.error) msg = body.error;
          } catch {
            // не-JSON, оставляем статус
          }
          dispatch({ type: 'STREAM_ERROR', error: msg });
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          dispatch({ type: 'STREAM_ERROR', error: 'no response body' });
          return;
        }
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // Парсим полные строки, неполный хвост оставляем в буфере.
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          // parseSseLines берёт строку — переиспользуем split.
          for (const ev of parseSseLines(lines.join('\n'))) {
            if (ev === '[DONE]') {
              dispatch({ type: 'STREAM_END' });
              return;
            }
            if (ev.error) {
              dispatch({ type: 'STREAM_ERROR', error: ev.error });
              return;
            }
            if (ev.thinking) {
              dispatch({ type: 'STREAM_THINKING', text: ev.thinking });
            } else if (ev.text) {
              dispatch({ type: 'STREAM_TEXT', text: ev.text });
            }
          }
        }
        dispatch({ type: 'STREAM_END' });
      } catch (err) {
        if (ctrl.signal.aborted) return; // отменили — это нормально
        const msg = err instanceof Error ? err.message : String(err);
        dispatch({ type: 'STREAM_ERROR', error: msg });
      }
    },
    [dispatch],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { send, cancel };
}
