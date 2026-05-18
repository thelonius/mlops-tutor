import { useCallback, useEffect, useRef, useState } from 'react';

export type MicState = 'idle' | 'recording' | 'transcribing' | 'denied';

interface UseMicOpts {
  onTranscript: (text: string) => void;
}

// Запись через MediaRecorder + отправка blob на /api/transcribe (Groq Whisper).
// Аналог micStart/micStop из legacy app.js. Состояние выставляем явно через
// state-машину, чтобы кнопка показывала корректную иконку.
export function useMic({ onTranscript }: UseMicOpts) {
  const [state, setState] = useState<MicState>('idle');
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => () => {
    // Cleanup на размонтирование: останавливаем запись и отпускаем треки.
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop();
      rec.stream.getTracks().forEach((t) => t.stop());
    }
    recRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (recRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const candidates = ['audio/webm', 'audio/ogg', 'audio/mp4'];
      const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      recRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.start();
      setState('recording');
    } catch {
      setState('denied');
      window.setTimeout(() => setState('idle'), 2000);
    }
  }, []);

  const stop = useCallback(async () => {
    const rec = recRef.current;
    if (!rec) return;
    rec.stop();
    rec.stream.getTracks().forEach((t) => t.stop());
    setState('transcribing');

    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
    });
    recRef.current = null;

    const chunks = chunksRef.current;
    if (chunks.length === 0) {
      setState('idle');
      return;
    }
    const type = chunks[0]?.type || 'audio/webm';
    const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type });
    const form = new FormData();
    form.append('audio', blob, `rec.${ext}`);
    try {
      const res = await fetch('/api/transcribe', { method: 'POST', body: form });
      const data = (await res.json()) as { text?: string };
      if (data.text) onTranscript(data.text);
    } catch {
      // тихо — UX и так понятный по smooth state переходу
    }
    setState('idle');
  }, [onTranscript]);

  return { state, start, stop };
}
