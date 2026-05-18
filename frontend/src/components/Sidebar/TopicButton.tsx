import { memo } from 'react';
import type { Topic } from '../../types';
import { DepthDots } from './DepthDots';

interface Props {
  tid: string;
  topic: Topic;
  active: boolean;
  done: boolean;
  onSelect: (tid: string) => void;
}

function TopicButtonInner({ tid, topic, active, done, onSelect }: Props) {
  const cls = `topic-btn${done ? ' done' : ''}${active ? ' active' : ''}`;
  return (
    <button type="button" className={cls} onClick={() => onSelect(tid)}>
      <span className="t-icon">{done ? '✓' : topic.emoji}</span>
      <span className="t-title">{topic.title}</span>
      <DepthDots tid={tid} />
    </button>
  );
}

export const TopicButton = memo(TopicButtonInner);
