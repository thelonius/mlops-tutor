import { lazy, Suspense } from 'react';
import { useStore } from './state/store';
import { useUi } from './state/ui';
import { Sidebar } from './components/Sidebar/Sidebar';
import { MessageList } from './components/Chat/MessageList';
import { Composer } from './components/Chat/Composer';
import { QuickActions } from './components/Chat/QuickActions';
import { ModelSelect } from './components/Chat/ModelSelect';
import { TooltipController } from './components/Glossary/Tooltip';
import { PlanetaryIndicator } from './components/PlanetaryIndicator';
import { useAutoStart } from './hooks/useAutoStart';
import { useShareLoader } from './hooks/useShareLoader';
import { useAstroTheme } from './hooks/useAstroTheme';
import type { Mode } from './types';

// Спец-режимы тянут hljs/lib/common (~95KB) и marked (~50KB) — грузим
// только когда пользователь реально переключился. Чат-путь стартует
// без этих чанков.
const CheatsheetView = lazy(() =>
  import('./components/Cheatsheet/CheatsheetView').then((m) => ({ default: m.CheatsheetView })),
);
const MCQuizView = lazy(() =>
  import('./components/MCQuiz/MCQuizView').then((m) => ({ default: m.MCQuizView })),
);
const LectureView = lazy(() =>
  import('./components/Lecture/LectureView').then((m) => ({ default: m.LectureView })),
);

function LazyFallback() {
  return (
    <div className="messages" style={{ padding: 24, color: 'var(--text-muted)' }}>
      Загружаю…
    </div>
  );
}

const MODE_LABELS: Record<Mode, { label: string; badge: string }> = {
  learn: { label: 'Объяснение', badge: 'badge-learn' },
  quiz: { label: 'Квиз', badge: 'badge-quiz' },
  mock: { label: 'Mock Interview', badge: 'badge-mock' },
  cheatsheet: { label: 'Чит-шит', badge: 'badge-cheatsheet' },
  mcquiz: { label: 'Тест', badge: 'badge-mcquiz' },
  lecture: { label: 'Лекция', badge: 'badge-lecture' },
};

export default function App() {
  useAstroTheme();
  useAutoStart();
  useShareLoader();
  const { state } = useStore();
  const ui = useUi();
  const { topic, mode, topics } = state;
  const cfg = MODE_LABELS[mode];

  return (
    <>
      <TooltipController />
      <div
        className={`overlay${ui.mobileSidebarOpen ? ' show' : ''}`}
        id="overlay"
        onClick={ui.closeMobileSidebar}
      />
      <Sidebar />
      <div className="main">
        <div className="chat-header">
          <button
            type="button"
            className="sidebar-toggle"
            id="sidebar-toggle"
            title="Свернуть меню"
            onClick={ui.toggleDesktopSidebar}
          >
            {ui.desktopSidebarCollapsed ? '▶' : '◀'}
          </button>
          <button
            type="button"
            className="hamburger"
            aria-label="Меню"
            onClick={ui.openMobileSidebar}
          >
            ☰
          </button>
          <span className="header-topic">
            {topic === '__vacancy__'
              ? `🎯 ${state.vacancy?.title ?? 'Интервью по вакансии'}`
              : topic && topics[topic]
                ? topics[topic].title
                : 'Выбери тему →'}
          </span>
          {state.vacancy && topic !== '__vacancy__' && (
            <span className="vacancy-badge">
              🎯 {state.vacancy.company}
            </span>
          )}
          <PlanetaryIndicator />
          <ModelSelect />
          <span className={`mode-badge ${cfg.badge}`}>{cfg.label}</span>
        </div>

        {mode === 'cheatsheet' ? (
          <Suspense fallback={<LazyFallback />}>
            <CheatsheetView />
          </Suspense>
        ) : mode === 'mcquiz' ? (
          <Suspense fallback={<LazyFallback />}>
            <MCQuizView />
          </Suspense>
        ) : mode === 'lecture' ? (
          <Suspense fallback={<LazyFallback />}>
            <LectureView />
          </Suspense>
        ) : (
          <>
            <MessageList />
            <QuickActions />
            <Composer />
          </>
        )}
      </div>
    </>
  );
}
