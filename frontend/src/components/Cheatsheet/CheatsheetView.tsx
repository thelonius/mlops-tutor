import { useRef } from 'react';
import { useStore } from '../../state/store';
import { useGlossaryDom } from '../../hooks/useGlossaryDom';
import { CheatsheetBlockView } from './blocks';
import type { CheatsheetBlock } from './types';

export function CheatsheetView() {
  const { state } = useStore();
  const { topic, topics } = state;
  const containerRef = useRef<HTMLDivElement>(null);
  useGlossaryDom(containerRef, [topic]);
  if (!topic) {
    return (
      <div id="cheatsheet-view" style={{ display: 'flex', flex: 1, padding: 24 }}>
        <div className="welcome">
          <h2>Чит-шит</h2>
          <p>Выбери тему слева — покажу шпаргалку для собеседования.</p>
        </div>
      </div>
    );
  }
  const t = topics[topic];
  if (!t) return null;

  const blocks = (t.cheatsheet_blocks as CheatsheetBlock[] | undefined) || [];
  const color = t.track === 'ml' ? '#22c55e' : '#a78bfa';

  return (
    <div
      id="cheatsheet-view"
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: 16, flex: 1 }}
    >
      <div className="cs-header">
        {t.emoji} {t.title}
      </div>
      {blocks.length > 0
        ? blocks.map((b, i) => <CheatsheetBlockView key={i} block={b} />)
        : (t.cheatsheet || []).map((pair, i) => (
            <div key={i} className="cs-card">
              <div className="cs-q" style={{ color }}>
                {pair.q}
              </div>
              <div className="cs-a">{pair.a}</div>
            </div>
          ))}
    </div>
  );
}
