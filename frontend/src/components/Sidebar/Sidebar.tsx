import { useMemo, type ReactNode } from 'react';
import { useStore } from '../../state/store';
import { useUi } from '../../state/ui';
import { loadHistory } from '../../state/persistence';
import type { Group, Topic } from '../../types';
import { ModeSelector } from './ModeSelector';
import { TopicButton } from './TopicButton';

export function Sidebar() {
  const { state, dispatch } = useStore();
  const ui = useUi();
  const { topic, mode, progress, curriculum, topics, curriculumStatus, curriculumError, vacancy, vacancyTopics } =
    state;

  const isVacancyInterview = topic === '__vacancy__';

  // Сколько групп в каждой секции. Если в секции одна группа — её заголовок
  // не показываем, чтобы не дублировать section-header.
  const sectionCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of curriculum) m[g.section] = (m[g.section] || 0) + 1;
    return m;
  }, [curriculum]);

  const onSelect = (tid: string) => {
    const msgs = loadHistory(tid, mode) ?? [];
    dispatch({ type: 'SELECT_TOPIC', topic: tid, messages: msgs });
    ui.closeMobileSidebar();
  };

  const exitInterview = () => {
    dispatch({ type: 'SET_MODE', mode: 'learn', messages: [] });
    dispatch({ type: 'SELECT_TOPIC', topic: curriculum[0]?.topics[0] ?? '', messages: [] });
    ui.closeMobileSidebar();
  };

  const cls = [
    'sidebar',
    ui.desktopSidebarCollapsed ? 'collapsed' : '',
    ui.mobileSidebarOpen ? 'open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls}>
      <div className="sidebar-header">
        <div>
          <h1>MLOps Tutor</h1>
          {vacancy
            ? <p title={vacancy.requirements ?? ''}>{vacancy.company} · {vacancy.title.slice(0, 40)}</p>
            : <p>Wildberries · Senior MLOps</p>
          }
        </div>
      </div>

      {isVacancyInterview ? (
        <div className="mode-section">
          <div className="section-label">Интервью по вакансии</div>
          <button type="button" className="mode-btn" onClick={exitInterview}>
            <span className="mode-icon">📚</span> Учиться по темам
          </button>
          {vacancyTopics && vacancyTopics.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="section-label" style={{ marginBottom: 4 }}>Темы интервью</div>
              {vacancyTopics.map((tid) => {
                const t = topics[tid];
                return t ? (
                  <div key={tid} style={{
                    padding: '3px 12px',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                  }}>
                    {t.emoji} {t.title}
                  </div>
                ) : null;
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          <ModeSelector />
          <div className="curriculum" id="curriculum-tree">
            {curriculumStatus === 'loading' && (
              <div style={{ color: 'var(--text-muted)', padding: '8px 12px' }}>Загрузка…</div>
            )}
            {curriculumStatus === 'error' && (
              <div style={{ color: '#ef4444', padding: '8px 12px' }}>
                Ошибка: {curriculumError}
              </div>
            )}
            {curriculumStatus === 'ready' && (
              <CurriculumTree
                curriculum={curriculum}
                sectionCounts={sectionCounts}
                topics={topics}
                activeTopic={topic}
                progress={progress}
                onSelect={onSelect}
              />
            )}
            {curriculumStatus === 'ready' && curriculum.length === 0 && (
              <div style={{ color: 'var(--text-muted)', padding: '8px 12px' }}>Пусто.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface TreeProps {
  curriculum: Group[];
  sectionCounts: Record<string, number>;
  topics: Record<string, Topic>;
  activeTopic: string | null;
  progress: Set<string>;
  onSelect: (tid: string) => void;
}

function CurriculumTree({
  curriculum,
  sectionCounts,
  topics,
  activeTopic,
  progress,
  onSelect,
}: TreeProps) {
  const nodes: ReactNode[] = [];
  let currentSection: string | null = null;

  for (const group of curriculum) {
    const section = group.section || '';
    if (section !== currentSection) {
      if (currentSection !== null) {
        nodes.push(<div key={`div-${section}-${group.id}`} className="week-divider" />);
      }
      nodes.push(
        <div key={`sec-${section}-${group.id}`} className="section-header">
          {section}
        </div>,
      );
      currentSection = section;
    }
    if (sectionCounts[section] > 1) {
      nodes.push(
        <div key={`grp-${group.id}`} className="group-label">
          {group.title}
        </div>,
      );
    }
    for (const tid of group.topics) {
      const t = topics[tid];
      if (!t) continue;
      nodes.push(
        <TopicButton
          key={tid}
          tid={tid}
          topic={t}
          active={activeTopic === tid}
          done={progress.has(tid)}
          onSelect={onSelect}
        />,
      );
    }
  }

  return <>{nodes}</>;
}
