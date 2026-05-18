import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { useChatStream } from './useChatStream';
import type { Mode } from '../types';

function initialOpener(mode: Mode, title: string): string | null {
  switch (mode) {
    case 'learn':
      return `Начнём тему "${title}". Объясни с нуля — я знаю Python и веб, но эту область не трогал.`;
    case 'quiz':
      return `Начнём квиз по теме "${title}". Задавай вопросы как на интервью.`;
    case 'mock':
      return 'Начнём mock-интервью. Я готов.';
    default:
      return null;
  }
}

// Когда выбрана тема в режиме learn/quiz/mock и истории нет — отправляем
// «opener»-сообщение, чтобы модель сразу начала. Аналог legacy
// selectTopic→autoStart. Защита от двойного запуска в StrictMode через
// ключ (topic, mode) — стартуем не более одного раза для пары.
export function useAutoStart() {
  const { state } = useStore();
  const { topic, mode, messages, streaming, topics, curriculumStatus, preferredModel } = state;
  const { send } = useChatStream();

  const firedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (curriculumStatus !== 'ready') return;
    if (!topic) return;
    if (streaming) return;
    if (messages.length > 0) return;

    const t = topics[topic];
    if (!t) return;
    const opener = initialOpener(mode, t.title);
    if (!opener) return;

    const key = `${topic}|${mode}`;
    if (firedKeyRef.current === key) return;
    firedKeyRef.current = key;

    void send({
      userMessage: { role: 'user', content: opener },
      historyBefore: [],
      topicId: topic,
      mode,
      model: preferredModel,
    });
  }, [curriculumStatus, topic, mode, messages.length, streaming, topics, preferredModel, send]);
}
