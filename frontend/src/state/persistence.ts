// Ключи и формат СТРОГО совпадают с тем, что использует static/app.js.
// Любое расхождение — пользователи теряют историю после миграции.
import type { Message, Mode } from '../types';

export const histKey = (tid: string, mode: Mode) => `mlops_chat_${tid}_${mode}`;
const SESSION_KEY = 'mlops_session';
const PROGRESS_KEY = 'mlops_progress';
const MODEL_KEY = 'mlops_model';
const SIDEBAR_COLLAPSED_KEY = 'mlops_sidebar_collapsed';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export function loadHistory(tid: string, mode: Mode): Message[] | null {
  try {
    const raw = localStorage.getItem(histKey(tid, mode));
    return raw ? (JSON.parse(raw) as Message[]) : null;
  } catch {
    return null;
  }
}

export function saveHistory(tid: string, mode: Mode, msgs: Message[]): void {
  localStorage.setItem(histKey(tid, mode), JSON.stringify(msgs));
}

export function clearHistory(tid: string, mode: Mode): void {
  localStorage.removeItem(histKey(tid, mode));
}

export interface SessionState {
  topic: string | null;
  mode: Mode;
}

export function loadSession(): SessionState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      topic: typeof parsed.topic === 'string' ? parsed.topic : null,
      mode: (parsed.mode as Mode) ?? 'learn',
    };
  } catch {
    return null;
  }
}

export function saveSession(s: SessionState): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function loadProgress(): Set<string> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveProgress(progress: Set<string>): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify([...progress]));
}

export function loadPreferredModel(): string {
  return localStorage.getItem(MODEL_KEY) ?? DEFAULT_MODEL;
}

export function savePreferredModel(model: string): void {
  localStorage.setItem(MODEL_KEY, model);
}

export function loadSidebarCollapsed(): boolean {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
}

export function saveSidebarCollapsed(collapsed: boolean): void {
  if (collapsed) localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1');
  else localStorage.removeItem(SIDEBAR_COLLAPSED_KEY);
}
