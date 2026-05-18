import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { useToast } from '../components/Toast';
import { loadShare } from '../lib/share';
import { saveHistory } from '../state/persistence';

// При маунте: если в URL есть ?s=...#k=..., расшифровываем сессию
// и подставляем topic/mode/messages в стор. Аналог tryLoadFromShare
// из legacy app.js.
export function useShareLoader() {
  const { state, dispatch } = useStore();
  const { topics, curriculumStatus } = state;
  const toast = useToast();
  const ranRef = useRef(false);

  useEffect(() => {
    if (curriculumStatus !== 'ready' || ranRef.current) return;
    const params = new URLSearchParams(location.search);
    if (!params.get('s')) return;
    ranRef.current = true;

    void (async () => {
      try {
        const shared = await loadShare();
        if (!shared || !shared.topic_id || !topics[shared.topic_id]) {
          toast.show('Ссылка повреждена');
          history.replaceState(null, '', '/');
          return;
        }
        const messages = Array.isArray(shared.messages) ? shared.messages : [];
        dispatch({ type: 'SET_MODE', mode: shared.mode || 'learn', messages: [] });
        dispatch({ type: 'SELECT_TOPIC', topic: shared.topic_id, messages });
        if (messages.length > 0) {
          saveHistory(shared.topic_id, shared.mode || 'learn', messages);
        }
        history.replaceState(null, '', '/');
        toast.show('Сессия загружена');
      } catch (e) {
        const msg = e instanceof Error && e.message === 'expired' ? 'Ссылка истекла' : 'Не получилось открыть ссылку';
        toast.show(msg);
        history.replaceState(null, '', '/');
      }
    })();
  }, [curriculumStatus, topics, dispatch, toast]);
}
