import { useCallback, useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import { useStore } from '../../state/store';
import { useChatStream } from '../../hooks/useChatStream';
import { useMic } from '../../hooks/useMic';
import { useComposerDraft } from './ComposerDraftContext';

export function Composer() {
  const { state } = useStore();
  const { topic, mode, messages, streaming, preferredModel, depth, vacancyId } = state;
  const { send } = useChatStream();
  const { draft: value, setDraft: setValue } = useComposerDraft();
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Синхронизируем высоту с содержимым при любом изменении черновика — в том
  // числе когда его извне очищает QuickActions, забрав текст как контекст.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [value]);

  const onTranscript = useCallback(
    (text: string) => {
      setValue(text);
      taRef.current?.focus();
    },
    [setValue],
  );
  const mic = useMic({ onTranscript });

  const submit = (text?: string) => {
    const msg = (text ?? value).trim();
    if (!msg || streaming || !topic) return;
    void send({
      userMessage: { role: 'user', content: msg },
      historyBefore: messages,
      topicId: topic,
      mode,
      model: preferredModel,
      depth,
      vacancyId,
    });
    if (text === undefined) setValue('');
  };

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const disabled = streaming || !topic;

  return (
    <div className="input-area" id="input-row">
      <div className="input-wrap">
        <textarea
          ref={taRef}
          value={value}
          onChange={onChange}
          onKeyDown={onKey}
          placeholder={
            topic
              ? 'Напиши вопрос или ответ... (Enter — отправить, Shift+Enter — новая строка)'
              : 'Сначала выбери тему слева'
          }
          rows={1}
          disabled={!topic}
        />
      </div>
      <button
        type="button"
        className="send-btn"
        disabled={disabled || value.trim().length === 0}
        onClick={() => submit()}
        title="Отправить"
      >
        ↑
      </button>
      <button
        type="button"
        className={`mic-btn${mic.state === 'recording' ? ' recording' : ''}`}
        title={
          mic.state === 'recording'
            ? 'Идёт запись — нажми чтобы остановить'
            : mic.state === 'transcribing'
              ? 'Распознаю…'
              : 'Голосовой ввод'
        }
        disabled={!topic || mic.state === 'transcribing'}
        onClick={() => {
          if (mic.state === 'recording') void mic.stop();
          else if (mic.state === 'idle') void mic.start();
        }}
      >
        {mic.state === 'recording'
          ? '⏹'
          : mic.state === 'transcribing'
            ? '⏳'
            : mic.state === 'denied'
              ? '🚫'
              : '🎙'}
      </button>
    </div>
  );
}
