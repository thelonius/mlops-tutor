import { useEffect } from 'react';
// Vite ?url-import возвращает URL ассета (с хешем в проде), куда указывает
// <link id="hljs-css">. Так умеем сменить тему подсветки кода без FOUC.
import darkHljsUrl from 'highlight.js/styles/github-dark.css?url';
import lightHljsUrl from 'highlight.js/styles/github.css?url';

type Theme = 'dark' | 'light';

function detect(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  const link = document.getElementById('hljs-css') as HTMLLinkElement | null;
  if (link) link.href = theme === 'dark' ? darkHljsUrl : lightHljsUrl;
}

// Тема следует системной (prefers-color-scheme). Inline-скрипт в index.html
// уже выставил data-theme до маунта React. Тут синхронизируем hljs-CSS и
// подписываемся на смену темы — иначе ночной режим в дневное время не
// переключится без перезагрузки.
export function useSystemTheme(): void {
  useEffect(() => {
    apply(detect());
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => apply(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
}
