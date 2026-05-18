import { useMemo, type ReactNode } from 'react';
import { useStore } from '../../state/store';
import { loadHistory } from '../../state/persistence';
import type { Group, Topic } from '../../types';
import { ModeSelector } from './ModeSelector';
import { TopicButton } from './TopicButton';

export function Sidebar() {
  const { state, dispatch } = useStore();
  const { topic, mode, progress, curriculum, topics, curriculumStatus, curriculumError } =
    state;

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
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div>
          <h1>MLOps Tutor</h1>
          <p>Wildberries · Senior MLOps</p>
        </div>
      </div>

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
