export type Mode = 'learn' | 'quiz' | 'mock' | 'cheatsheet' | 'mcquiz' | 'lecture';

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
