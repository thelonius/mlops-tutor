import { useStore } from './state/store';
import { Sidebar } from './components/Sidebar/Sidebar';

export default function App() {
  const { state } = useStore();
  const { topic, mode, messages, topics } = state;

  return (
    <>
      <Sidebar />
      <div className="main">
        <div className="chat-header">
          <span className="header-topic">
            {topic && topics[topic] ? topics[topic].title : 'Выбери тему →'}
          </span>
          <span className="mode-badge badge-learn" id="mode-badge">
            {labelFor(mode)}
          </span>
        </div>

        <div className="messages" style={{ padding: 16 }}>
          {!topic ? (
            <div className="welcome">
              <h2>Phase 2</h2>
              <p>
                Sidebar и выбор темы готовы. Чат подключим в Phase 3 — там будет
                стриминг ответов, persistence истории и quick-actions.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ color: 'var(--text-muted)' }}>
                Тема: <b>{topics[topic]?.title}</b> · режим: <b>{labelFor(mode)}</b> · сообщений
                в истории: <b>{messages.length}</b>
              </p>
              <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                Чат-UI будет в следующей фазе. Сейчас selectTopic пишет в store + localStorage,
                refresh страницы восстанавливает выбор.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function labelFor(mode: string): string {
  switch (mode) {
    case 'learn':
      return 'Объяснение';
    case 'quiz':
      return 'Квиз';
    case 'mock':
      return 'Mock Interview';
    case 'cheatsheet':
      return 'Чит-шит';
    case 'mcquiz':
      return 'Тест';
    case 'lecture':
      return 'Лекция';
    default:
      return mode;
  }
}
