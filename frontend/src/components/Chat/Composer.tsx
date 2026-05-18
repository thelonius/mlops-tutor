import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useStore } from '../../state/store';
import { useChatStream } from '../../hooks/useChatStream';

export function Composer() {
  const { state } = useStore();
  const { topic, mode, messages, streaming, preferredModel } = state;
  const { send } = useChatStream();
  const [value, setValue] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = (text?: string) => {
    const msg = (text ?? value).trim();
    if (!msg || streaming || !topic) return;
    void send({
      userMessage: { role: 'user', content: msg },
      historyBefore: messages,
      topicId: topic,
      mode,
      model: preferredModel,
    });
    if (text === undefined) {
      setValue('');
      if (taRef.current) taRef.current.style.height = 'auto';
    }
  };

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
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
    </div>
  );
}
