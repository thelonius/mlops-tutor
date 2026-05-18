import { useSyncExternalStore } from 'react';
import { loadHistory } from '../state/persistence';
import type { Mode } from '../types';

// Depth = пар сообщений (user+assistant) в сохранённой истории. Используется
// в индикаторе прогресса по теме. Подписываемся на storage-событие, чтобы
// открытая в другой вкладке версия могла обновлять метрику.
function subscribe(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

export function useDepth(tid: string, mode: Mode): number {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor((loadHistory(tid, mode)?.length ?? 0) / 2),
    () => 0,
  );
}
