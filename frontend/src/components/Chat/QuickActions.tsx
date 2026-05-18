import { useStore } from '../../state/store';
import { useChatStream } from '../../hooks/useChatStream';
import { clearHistory, loadHistory } from '../../state/persistence';
import { createShare } from '../../lib/share';
import { useToast } from '../Toast';
import type { Mode } from '../../types';

type Action =
  | { label: string; msg: string }
  | { label: string; action: 'switchMode' | 'restart'; mode?: Mode };

const QUICK: Partial<Record<Mode, Action[]>> = {
  learn: [
    { label: '🔄 Объясни иначе', msg: 'Объясни иначе — другими словами или аналогией.' },
    { label: '💻 Пример кода', msg: 'Покажи конкретный пример кода или конфига.' },
    { label: '🎯 Главное для интервью', msg: 'Что самое важное запомнить для собеседования? Кратко.' },
    { label: '🧠 Перейти к квизу', action: 'switchMode', mode: 'quiz' },
    { label: '🗑️ Сначала', action: 'restart' },
  ],
  quiz: [
    { label: '💡 Подсказку', msg: 'Дай минимальную подсказку, не раскрывая ответ.' },
    { label: '✅ Правильный ответ', msg: 'Объясни правильный ответ.' },
    { label: '➡️ Следующий вопрос', msg: 'Следующий вопрос.' },
    { label: '📖 К объяснению', action: 'switchMode', mode: 'learn' },
    { label: '🗑️ Сначала', action: 'restart' },
  ],
  mock: [
    { label: '💡 Намекни', msg: 'Я застрял — дай подсказку без прямого ответа.' },
    { label: '⏸️ Фидбек', msg: 'Дай фидбек по моим ответам пока что.' },
    { label: '➡️ Следующий вопрос', msg: 'Следующий вопрос.' },
    { label: '🗑️ Сначала', action: 'restart' },
  ],
};

export function QuickActions() {
  const { state, dispatch } = useStore();
  const { mode, topic, messages, streaming, preferredModel, topics } = state;
  const { send } = useChatStream();
  const toast = useToast();

  const actions = topic ? QUICK[mode] : undefined;
  if (!topic || !actions) return null;

  const canShare = messages.length > 0;
  const onShare = async () => {
    if (!topic || !canShare) return;
    try {
      const url = await createShare({ v: 1, topic_id: topic, mode, messages });
      await navigator.clipboard.writeText(url);
      toast.show('Ссылка скопирована');
    } catch (e) {
      toast.show('Не получилось: ' + (e instanceof Error ? e.message : 'ошибка'));
    }
  };

  const onClick = (a: Action) => {
    if ('msg' in a) {
      if (streaming) return;
      void send({
        userMessage: { role: 'user', content: a.msg },
        historyBefore: messages,
        topicId: topic,
        mode,
        model: preferredModel,
      });
      return;
    }
    if (a.action === 'switchMode' && a.mode) {
      const msgs = loadHistory(topic, a.mode) ?? [];
      dispatch({ type: 'SET_MODE', mode: a.mode, messages: msgs });
      return;
    }
    if (a.action === 'restart') {
      clearHistory(topic, mode);
      const opener = openerFor(topic, mode, topics[topic]?.title ?? '');
      if (opener) {
        void send({
          userMessage: { role: 'user', content: opener },
          historyBefore: [],
          topicId: topic,
          mode,
          model: preferredModel,
        });
      } else {
        dispatch({ type: 'SET_MESSAGES', messages: [] });
      }
    }
  };

  return (
    <div className="quick-area" id="quick-area">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          className="qbtn"
          disabled={streaming}
          onClick={() => onClick(a)}
        >
          {a.label}
        </button>
      ))}
      {canShare && (
        <button
          type="button"
          className="qbtn"
          style={{ marginLeft: 'auto' }}
          disabled={streaming}
          onClick={onShare}
        >
          🔗 Поделиться
        </button>
      )}
    </div>
  );
}

export function openerFor(_topicId: string, mode: Mode, title: string): string | null {
  switch (mode) {
    case 'learn':
      return `Начнём тему "${title}" заново. Объясни с нуля.`;
    case 'quiz':
      return `Начнём квиз по теме "${title}" заново.`;
    case 'mock':
      return 'Начнём mock-интервью заново. Я готов.';
    default:
      return null;
  }
}
