import { useSharedTts } from '../TtsProvider';
import type { Mode } from '../../types';

interface Props {
  text: string;
  // Кнопка «Далее»/«Следующий» — только на последнем ai-баббле и в режимах
  // learn/quiz/mock.
  showNext: boolean;
  nextMode: Mode;
  onNext: () => void;
}

export function BubbleActions({ text, showNext, nextMode, onNext }: Props) {
  const tts = useSharedTts();

  const ttsLabel =
    tts.state === 'loading'
      ? '✕ Отменить'
      : tts.state === 'playing'
        ? '⏸ Пауза'
        : tts.state === 'paused'
          ? '▶ Продолжить'
          : '🔊 Слушать';
  const ttsCls =
    'tts-btn' +
    (tts.state === 'loading' ? ' tts-loading' : '') +
    (tts.state === 'playing' ? ' tts-playing' : '') +
    (tts.state === 'paused' ? ' tts-paused' : '');

  const onTtsClick = () => {
    // Если уже играем/пауза — просто toggle. Если loading — это уже наш
    // трек, повторный клик отменяет. Если idle — стартуем новый.
    if (tts.state === 'playing' || tts.state === 'paused') {
      tts.toggle();
    } else if (tts.state === 'loading') {
      tts.reset();
    } else {
      void tts.speak(text);
    }
  };

  const nextLabel = nextMode === 'learn' ? '➡️ Далее' : '➡️ Следующий';

  return (
    <div style={{ marginLeft: 56, marginTop: -4, marginBottom: 16, display: 'flex', gap: 8 }}>
      <button type="button" className={ttsCls} onClick={onTtsClick} title="Прочитать вслух">
        {ttsLabel}
      </button>
      {showNext && (
        <button type="button" className="next-q-btn" onClick={onNext}>
          {nextLabel}
        </button>
      )}
    </div>
  );
}
