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
  | { type: 'STREAM_START' }
  | { type: 'STREAM_END' }
  | { type: 'MARK_DONE'; topic: string }
  | { type: 'SET_MODEL'; model: string };

const initialState: State = {
  topic: null,
  mode: 'learn',
  messages: [],
  streaming: false,
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
      return { ...state, topic: action.topic, messages: action.messages };
    case 'SET_MODE':
      return { ...state, mode: action.mode, messages: action.messages };
    case 'SET_MESSAGES':
      return { ...state, messages: action.messages };
    case 'APPEND_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };
    case 'STREAM_START':
      return { ...state, streaming: true };
    case 'STREAM_END':
      return { ...state, streaming: false };
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

  // Персистенс messages per (topic, mode). Пишем только если topic выбран
  // и история непустая — иначе можем затереть существующую при ре-маунте.
  useEffect(() => {
    if (!state.topic || state.messages.length === 0) return;
    saveHistory(state.topic, state.mode, state.messages);
  }, [state.topic, state.mode, state.messages]);

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
