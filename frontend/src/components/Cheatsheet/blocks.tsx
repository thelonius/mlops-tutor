import { useEffect, useRef, type ReactElement } from 'react';
// 'common' включает 35+ ходовых языков (python, bash, yaml, json, dockerfile,
// js/ts, sql) и весит ~95KB. Полный пакет — 800KB. Если когда-то понадобится
// экзотика — регистрируй languages адресно через registerLanguage.
import hljs from 'highlight.js/lib/common';
import { csBlock, csEscape, csInline } from '../../lib/markdown';
import type { CheatsheetBlock, FlowBranch } from './types';

// Inline-HTML вставка для контента из curriculum.py. Источник — наш,
// XSS-вектора тут нет.
function Inline({ html }: { html: string }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function Title({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <div className="cs-block-title">
      <Inline html={csInline(title)} />
    </div>
  );
}

function Tldr({ block }: { block: Extract<CheatsheetBlock, { type: 'tldr' }> }) {
  return (
    <div
      className="cs-block cs-tldr"
      dangerouslySetInnerHTML={{ __html: csBlock(block.content || '') }}
    />
  );
}

function CodeBlock({ block }: { block: Extract<CheatsheetBlock, { type: 'code' }> }) {
  const ref = useRef<HTMLElement>(null);
  const lang = block.lang || 'plaintext';
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // В StrictMode dev-маунт срабатывает дважды. Без guard'а hljs пишет
    // «Element previously highlighted» — функционально ОК, но шумит в консоли.
    if (el.dataset.highlighted) return;
    hljs.highlightElement(el);
  }, [block.code, block.lang]);
  return (
    <div className="cs-block cs-code">
      {block.caption && (
        <div className="cs-code-caption">
          <Inline html={csInline(block.caption)} />
        </div>
      )}
      <pre>
        <code ref={ref} className={`language-${csEscape(lang)}`}>
          {block.code || ''}
        </code>
      </pre>
    </div>
  );
}

function TableBlock({ block }: { block: Extract<CheatsheetBlock, { type: 'table' }> }) {
  return (
    <div className="cs-block cs-table-wrap">
      <Title title={block.title} />
      <table className="cs-table">
        <thead>
          <tr>
            {(block.headers || []).map((h, i) => (
              <th key={i}>
                <Inline html={csInline(h)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(block.rows || []).map((row, i) => (
            <tr key={i}>
              {(row || []).map((cell, j) => (
                <td key={j}>
                  <Inline html={csInline(cell)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {block.note && (
        <div className="cs-block-note">
          <Inline html={csInline(block.note)} />
        </div>
      )}
    </div>
  );
}

function CompareBlock({ block }: { block: Extract<CheatsheetBlock, { type: 'compare' }> }) {
  return (
    <div className="cs-block cs-compare">
      <Title title={block.title} />
      <div className="cs-compare-grid">
        {(block.items || []).map((it, i) => (
          <div key={i} className="cs-compare-col">
            <div
              className="cs-compare-title"
              style={it.color ? { color: it.color } : undefined}
            >
              <Inline html={csInline(it.title || '')} />
            </div>
            <ul>
              {(it.points || []).map((p, j) => (
                <li key={j}>
                  <Inline html={csInline(p)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListBlock({ block }: { block: Extract<CheatsheetBlock, { type: 'list' }> }) {
  const kind = block.kind || 'plain';
  const Tag: 'ol' | 'ul' = kind === 'steps' ? 'ol' : 'ul';
  return (
    <div className={`cs-block cs-list cs-list-${csEscape(kind)}`}>
      <Title title={block.title} />
      <Tag>
        {(block.items || []).map((it, i) => (
          <li key={i}>
            <Inline html={csInline(it)} />
          </li>
        ))}
      </Tag>
    </div>
  );
}

const CALLOUT_ICONS: Record<string, string> = {
  warning: '⚠️',
  tip: '💡',
  fact: '📌',
  gotcha: '🪤',
};

function CalloutBlock({ block }: { block: Extract<CheatsheetBlock, { type: 'callout' }> }) {
  const kind = block.kind || 'tip';
  return (
    <div className={`cs-block cs-callout cs-callout-${csEscape(kind)}`}>
      <span className="cs-callout-icon">{CALLOUT_ICONS[kind] || '📌'}</span>
      <div
        className="cs-callout-body"
        dangerouslySetInnerHTML={{ __html: csBlock(block.content || '') }}
      />
    </div>
  );
}

function Branch({ branch, depth }: { branch: FlowBranch; depth: number }) {
  return (
    <>
      <div className="cs-flow-branch" style={{ marginLeft: depth * 18 }}>
        {branch.condition && (
          <span className="cs-flow-cond">
            <Inline html={csInline(branch.condition)} />
          </span>
        )}
        {branch.outcome && <span className="cs-flow-arrow">→</span>}
        {branch.outcome && (
          <span className="cs-flow-out">
            <Inline html={csInline(branch.outcome)} />
          </span>
        )}
      </div>
      {(branch.children || []).map((c, i) => (
        <Branch key={i} branch={c} depth={depth + 1} />
      ))}
    </>
  );
}

function FlowBlock({ block }: { block: Extract<CheatsheetBlock, { type: 'flow' }> }) {
  return (
    <div className="cs-block cs-flow">
      <Title title={block.title} />
      {(block.branches || []).map((br, i) => (
        <Branch key={i} branch={br} depth={0} />
      ))}
    </div>
  );
}

function MatrixBlock({ block }: { block: Extract<CheatsheetBlock, { type: 'matrix' }> }) {
  const cols = block.cols || [];
  const rows = block.rows || [];
  const cells = block.cells || [];
  const meta = block.cellMeta || [];
  return (
    <div className="cs-block cs-matrix-wrap">
      <Title title={block.title} />
      <table className="cs-matrix">
        <tbody>
          <tr>
            <th />
            {cols.map((c, i) => (
              <th key={i}>
                <Inline html={csInline(c)} />
              </th>
            ))}
          </tr>
          {rows.map((rowLabel, i) => (
            <tr key={i}>
              <th>
                <Inline html={csInline(rowLabel)} />
              </th>
              {(cells[i] || []).map((cell, j) => {
                const m = meta[i]?.[j];
                const cls = m?.class ? `cs-matrix-${csEscape(m.class)}` : undefined;
                return (
                  <td key={j} className={cls}>
                    <Inline html={csInline(cell)} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KvBlock({ block }: { block: Extract<CheatsheetBlock, { type: 'kv' }> }) {
  return (
    <div className="cs-block cs-kv">
      <Title title={block.title} />
      <dl>
        {(block.items || []).map((it, i) => (
          <div key={i} className="cs-kv-row">
            <dt>
              <Inline html={csInline(it.k || '')} />
            </dt>
            <dd>
              <Inline html={csInline(it.v || '')} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function CheatsheetBlockView({ block }: { block: CheatsheetBlock }): ReactElement | null {
  switch (block.type) {
    case 'tldr':
      return <Tldr block={block} />;
    case 'code':
      return <CodeBlock block={block} />;
    case 'table':
      return <TableBlock block={block} />;
    case 'compare':
      return <CompareBlock block={block} />;
    case 'list':
      return <ListBlock block={block} />;
    case 'callout':
      return <CalloutBlock block={block} />;
    case 'flow':
      return <FlowBlock block={block} />;
    case 'matrix':
      return <MatrixBlock block={block} />;
    case 'kv':
      return <KvBlock block={block} />;
    default:
      return null;
  }
}
