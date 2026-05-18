import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { Group, Message, Mode, Topic } from '../types';
import { fetchCurriculum } from '../api';
import {
  loadHistory,
  loadPreferredModel,
  loadProgress,
  loadSession,
  saveHistory,
  savePreferredModel,
  saveProgress,
  saveSession,
} from './persistence';

export interface State {
  topic: string | null;
  mode: Mode;
  messages: Message[];
  streaming: boolean;
  thinking: string;
  progress: Set<string>;
  preferredModel: string;
  curriculum: Group[];
  topics: Record<string, Topic>;
  curriculumStatus: 'idle' | 'loading' | 'ready' | 'error';
  curriculumError: string | null;
}

export type Action =
  | { type: 'CURRICULUM_LOAD' }
  | { type: 'CURRICULUM_READY'; curriculum: Group[]; topics: Record<string, Topic> }
  | { type: 'CURRICULUM_ERROR'; error: string }
  | { type: 'SELECT_TOPIC'; topic: string; messages: Message[] }
  | { type: 'SET_MODE'; mode: Mode; messages: Message[] }
  | { type: 'SET_MESSAGES'; messages: Message[] }
  | { type: 'APPEND_MESSAGE'; message: Message }
  | { type: 'STREAM_START'; userMessage: Message }
  | { type: 'STREAM_TEXT'; text: string }
  | { type: 'STREAM_THINKING'; text: string }
  | { type: 'STREAM_END' }
  | { type: 'STREAM_ERROR'; error: string }
  | { type: 'MARK_DONE'; topic: string }
  | { type: 'SET_MODEL'; model: string };

const initialState: State = {
  topic: null,
  mode: 'learn',
  messages: [],
  streaming: false,
  thinking: '',
  progress: new Set(),
  preferredModel: 'llama-3.3-70b-versatile',
  curriculum: [],
  topics: {},
  curriculumStatus: 'idle',
  curriculumError: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'CURRICULUM_LOAD':
      return { ...state, curriculumStatus: 'loading', curriculumError: null };
    case 'CURRICULUM_READY':
      return {
        ...state,
        curriculumStatus: 'ready',
        curriculum: action.curriculum,
        topics: action.topics,
      };
    case 'CURRICULUM_ERROR':
      return { ...state, curriculumStatus: 'error', curriculumError: action.error };
    case 'SELECT_TOPIC':
      return {
        ...state,
        topic: action.topic,
        messages: action.messages,
        thinking: '',
        streaming: false,
      };
    case 'SET_MODE':
      return {
        ...state,
        mode: action.mode,
        messages: action.messages,
        thinking: '',
        streaming: false,
      };
    case 'SET_MESSAGES':
      return { ...state, messages: action.messages };
    case 'APPEND_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };
    case 'STREAM_START':
      // Кладём сообщение пользователя + пустого ассистента, чтобы стрим
      // обновлял ровно последний пузырь.
      return {
        ...state,
        streaming: true,
        thinking: '',
        messages: [...state.messages, action.userMessage, { role: 'assistant', content: '' }],
      };
    case 'STREAM_TEXT': {
      // Реальный ответ начался — стираем preview размышлений.
      const last = state.messages[state.messages.length - 1];
      if (!last || last.role !== 'assistant') return state;
      const updated = [...state.messages];
      updated[updated.length - 1] = { ...last, content: last.content + action.text };
      return { ...state, messages: updated, thinking: '' };
    }
    case 'STREAM_THINKING':
      return { ...state, thinking: state.thinking + action.text };
    case 'STREAM_END':
      return { ...state, streaming: false, thinking: '' };
    case 'STREAM_ERROR': {
      const last = state.messages[state.messages.length - 1];
      const errMsg: Message = {
        role: 'assistant',
        content: `_(ошибка: ${action.error})_`,
      };
      const updated = [...state.messages];
      if (last && last.role === 'assistant' && last.content === '') {
        updated[updated.length - 1] = errMsg;
      } else {
        updated.push(errMsg);
      }
      return { ...state, messages: updated, streaming: false, thinking: '' };
    }
    case 'MARK_DONE': {
      if (state.progress.has(action.topic)) return state;
      const next = new Set(state.progress);
      next.add(action.topic);
      return { ...state, progress: next };
    }
    case 'SET_MODEL':
      return { ...state, preferredModel: action.model };
    default:
      return state;
  }
}

interface StoreContextValue {
  state: State;
  dispatch: Dispatch<Action>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, hydrate);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'CURRICULUM_LOAD' });
    fetchCurriculum()
      .then((data) => {
        if (cancelled) return;
        dispatch({
          type: 'CURRICULUM_READY',
          curriculum: data.curriculum,
          topics: data.topics,
        });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        dispatch({ type: 'CURRICULUM_ERROR', error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Гидрация topic из session — только когда curriculum загружен и тема
  // действительно есть в topics (иначе ссылка на удалённую тему).
  const hydratedFromSession = useRef(false);
  useEffect(() => {
    if (state.curriculumStatus !== 'ready' || hydratedFromSession.current) return;
    hydratedFromSession.current = true;
    const sess = loadSession();
    if (!sess?.topic || !state.topics[sess.topic]) return;
    const mode = sess.mode;
    const msgs = loadHistory(sess.topic, mode) ?? [];
    dispatch({ type: 'SET_MODE', mode, messages: [] });
    dispatch({ type: 'SELECT_TOPIC', topic: sess.topic, messages: msgs });
  }, [state.curriculumStatus, state.topics]);

  // Персистенс session (topic + mode).
  useEffect(() => {
    saveSession({ topic: state.topic, mode: state.mode });
  }, [state.topic, state.mode]);

  // Персистенс messages per (topic, mode). Не пишем во время стрима —
  // иначе на refresh подхватим частичный ответ ассистента.
  useEffect(() => {
    if (!state.topic || state.messages.length === 0 || state.streaming) return;
    saveHistory(state.topic, state.mode, state.messages);
  }, [state.topic, state.mode, state.messages, state.streaming]);

  useEffect(() => {
    saveProgress(state.progress);
  }, [state.progress]);

  useEffect(() => {
    savePreferredModel(state.preferredModel);
  }, [state.preferredModel]);

  return (
    <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>
  );
}

function hydrate(base: State): State {
  return {
    ...base,
    progress: loadProgress(),
    preferredModel: loadPreferredModel(),
  };
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
