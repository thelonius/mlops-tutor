export type Mode = 'learn' | 'quiz' | 'mock' | 'cheatsheet' | 'mcquiz' | 'lecture' | 'socratic';

// Глубина подачи в learn-режиме. 'basic' — компактно (до 300 слов, один концепт),
// 'senior' — глубже (trade-offs, внутренности, failure modes, до 500 слов).
export type Depth = 'basic' | 'senior';

export type Role = 'user' | 'assistant';

export interface Message {
  role: Role;
  content: string;
}

export interface CheatsheetItem {
  q: string;
  a: string;
}

export interface Topic {
  title: string;
  emoji: string;
  week: number;
  what: string;
  why: string;
  interview_focus: string;
  track: string;
  cheatsheet?: CheatsheetItem[];
  cheatsheet_blocks?: unknown;
}

export interface Group {
  id: string;
  section: string;
  title: string;
  topics: string[];
}

export interface CurriculumPayload {
  curriculum: Group[];
  topics: Record<string, Topic>;
}
