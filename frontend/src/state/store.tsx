import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { Depth, Group, Message, Mode, Topic } from '../types';
import { fetchCurriculum, fetchVacancyCurriculum } from '../api';
import { DEFAULT_MODEL } from './models';
import {
  loadDepth,
  loadHistory,
  loadPreferredModel,
  loadProgress,
  loadSession,
  saveDepth,
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
  depth: Depth;
  curriculum: Group[];
  topics: Record<string, Topic>;
  curriculumStatus: 'idle' | 'loading' | 'ready' | 'error';
  curriculumError: string | null;
  vacancyId: string | null;
  vacancy: { title: string; company: string; stack: string; requirements?: string; vibes?: string } | null;
  vacancyTopics: string[] | null;
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
  | { type: 'SET_MODEL'; model: string }
  | { type: 'SET_DEPTH'; depth: Depth }
  | { type: 'SET_VACANCY_ID'; vacancyId: string | null }
  | { type: 'SET_VACANCY_DETAILS'; vacancy: { title: string; company: string; stack: string; requirements?: string; vibes?: string } | null }
  | { type: 'SET_VACANCY_TOPICS'; topics: string[] | null };

const initialState: State = {
  topic: null,
  mode: 'learn',
  messages: [],
  streaming: false,
  thinking: '',
  progress: new Set(),
  preferredModel: DEFAULT_MODEL,
  depth: 'basic',
  curriculum: [],
  topics: {},
  curriculumStatus: 'idle',
  curriculumError: null,
  vacancyId: null,
  vacancy: null,
  vacancyTopics: null,
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
    case 'SET_DEPTH':
      return { ...state, depth: action.depth };
    case 'SET_VACANCY_ID':
      return { ...state, vacancyId: action.vacancyId };
    case 'SET_VACANCY_DETAILS':
      return { ...state, vacancy: action.vacancy };
    case 'SET_VACANCY_TOPICS':
      return { ...state, vacancyTopics: action.topics };
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

    // 1. Проверяем URL на наличие vacancy_id (в path или в query)
    const path = window.location.pathname;
    let vId = null;
    if (path.startsWith('/vacancy/')) {
      vId = path.split('/vacancy/')[1];
    } else {
      const params = new URLSearchParams(window.location.search);
      vId = params.get('vacancy_id');
    }

    if (vId) {
      dispatch({ type: 'SET_VACANCY_ID', vacancyId: vId });
    }

    const loadData = async () => {
      try {
        let data;
        if (vId) {
          data = await fetchVacancyCurriculum(vId);
          dispatch({
            type: 'SET_VACANCY_ID',
            vacancyId: vId,
          });
          // Сохраняем детали вакансии для UI-бейджа
          if (data.vacancy) {
            // Мы должны добавить экшен SET_VACANCY_DETAILS или использовать SET_VACANCY_ID
            // Чтобы не плодить экшены, я расширю SET_VACANCY_ID или добавлю новый.
            // Но сейчас просто использую dispatch с типом, который я добавлю в reducer.
            dispatch({ type: 'SET_VACANCY_DETAILS', vacancy: data.vacancy });
          }
          // Сохраняем список топиков вакансии для sidebar-agenda
          if (data.topics) {
            dispatch({ type: 'SET_VACANCY_TOPICS', topics: Object.keys(data.topics) });
          }
          // Автозаходим в режим интервью по вакансии
          dispatch({ type: 'SET_MODE', mode: 'mock', messages: [] });
          dispatch({ type: 'SELECT_TOPIC', topic: '__vacancy__', messages: [] });
        } else {
          data = await fetchCurriculum();
        }
        if (cancelled) return;
        dispatch({
          type: 'CURRICULUM_READY',
          curriculum: data.curriculum,
          topics: data.topics,
        });
      } catch (err: any) {
        if (cancelled) return;
        dispatch({ type: 'CURRICULUM_ERROR', error: err.message });
      }
    };

    loadData();
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

  useEffect(() => {
    saveDepth(state.depth);
  }, [state.depth]);

  return (
    <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>
  );
}

function hydrate(base: State): State {
  return {
    ...base,
    progress: loadProgress(),
    preferredModel: loadPreferredModel(),
    depth: loadDepth(),
  };
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
