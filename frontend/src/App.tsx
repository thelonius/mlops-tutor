import { useStore } from './state/store';
import { Sidebar } from './components/Sidebar/Sidebar';
import { MessageList } from './components/Chat/MessageList';
import { Composer } from './components/Chat/Composer';
import { QuickActions } from './components/Chat/QuickActions';
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

  // Cheatsheet / mcquiz / lecture полностью прячут чат — у них свои view.
  // На Phase 3 их ещё нет; показываем placeholder.
  const isSpecialMode = mode === 'cheatsheet' || mode === 'mcquiz' || mode === 'lecture';

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

        {isSpecialMode ? (
          <div className="messages" style={{ padding: 24 }}>
            <div className="welcome">
              <h2>Режим «{cfg.label}»</h2>
              <p>Этот режим переезжает на v2 в Phase 4. Пока вернись к Объяснение/Квиз/Mock.</p>
            </div>
          </div>
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
