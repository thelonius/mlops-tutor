import { useStore } from './state/store';
import { Sidebar } from './components/Sidebar/Sidebar';
import { MessageList } from './components/Chat/MessageList';
import { Composer } from './components/Chat/Composer';
import { QuickActions } from './components/Chat/QuickActions';
import { CheatsheetView } from './components/Cheatsheet/CheatsheetView';
import { MCQuizView } from './components/MCQuiz/MCQuizView';
import { LectureView } from './components/Lecture/LectureView';
import { useAutoStart } from './hooks/useAutoStart';
import type { Mode } from './types';

const MODE_LABELS: Record<Mode, { label: string; badge: string }> = {
  learn: { label: 'Объяснение', badge: 'badge-learn' },
  quiz: { label: 'Квиз', badge: 'badge-quiz' },
  mock: { label: 'Mock Interview', badge: 'badge-mock' },
  cheatsheet: { label: 'Чит-шит', badge: 'badge-cheatsheet' },
  mcquiz: { label: 'Тест', badge: 'badge-mcquiz' },
  lecture: { label: 'Лекция', badge: 'badge-lecture' },
};

export default function App() {
  useAutoStart();
  const { state } = useStore();
  const { topic, mode, topics } = state;
  const cfg = MODE_LABELS[mode];

  return (
    <>
      <Sidebar />
      <div className="main">
        <div className="chat-header">
          <span className="header-topic">
            {topic && topics[topic] ? topics[topic].title : 'Выбери тему →'}
          </span>
          <span className={`mode-badge ${cfg.badge}`}>{cfg.label}</span>
        </div>

        {mode === 'cheatsheet' ? (
          <CheatsheetView />
        ) : mode === 'mcquiz' ? (
          <MCQuizView />
        ) : mode === 'lecture' ? (
          <LectureView />
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
