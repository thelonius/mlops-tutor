import { useStore } from '../../state/store';
import { useChatStream } from '../../hooks/useChatStream';
import { clearHistory, loadHistory } from '../../state/persistence';
import { createShare } from '../../lib/share';
import { useToast } from '../Toast';
import { useComposerDraft } from './ComposerDraftContext';
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
  const { mode, topic, messages, streaming, preferredModel, topics, vacancyId } = state;
  const { send } = useChatStream();
  const { draft, setDraft } = useComposerDraft();
  const toast = useToast();

  const actions = topic ? QUICK[mode] : undefined;
  if (!topic || !actions) return null;

  // Текст из поля ввода подмешивается как контекст к любому действию-сообщению.
  const ctx = draft.trim();
  const hasCtx = ctx.length > 0;

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
      // Пустое поле — ведём себя ровно как раньше. Есть текст — уходит вместе
      // с действием как контекст, а поле очищаем.
      const content = hasCtx ? `${a.msg}\n\nМой контекст: ${ctx}` : a.msg;
      void send({
        userMessage: { role: 'user', content },
        historyBefore: messages,
        topicId: topic,
        mode,
        model: preferredModel,
        depth: state.depth,
        vacancyId,
      });
      if (hasCtx) setDraft('');
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
          depth: state.depth,
          vacancyId,
        });
      } else {
        dispatch({ type: 'SET_MESSAGES', messages: [] });
      }
    }
  };

  return (
    <div className="quick-area" id="quick-area">
      {actions.map((a) => {
        const isMsg = 'msg' in a;
        const withCtx = isMsg && hasCtx;
        return (
          <button
            key={a.label}
            type="button"
            className={`qbtn${withCtx ? ' has-ctx' : ''}`}
            disabled={streaming}
            title={
              isMsg
                ? withCtx
                  ? 'Уйдёт вместе с текстом из поля как контекстом'
                  : 'Впиши заметку в поле ввода — она уйдёт как контекст'
                : undefined
            }
            onClick={() => onClick(a)}
          >
            {a.label}
          </button>
        );
      })}
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
