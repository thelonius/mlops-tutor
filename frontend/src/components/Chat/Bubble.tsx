import { memo, useMemo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { rehypeHljsMini } from '../../lib/rehype-hljs-mini';
import { rehypeGlossary } from '../../lib/rehype-glossary';
import { useGlossary } from '../Glossary/GlossaryProvider';
import { useChatActions } from './ChatActionsContext';
import type { Role } from '../../types';

interface Props {
  role: Role;
  content: string;
  // typing=true показывает '...' пока контент пустой (стрим стартовал, но
  // первый ev_text ещё не пришёл).
  typing?: boolean;
}

// Извлекает текст из вложенных нод (markdown-AST), включая spans glossary.
function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return extractText(props?.children);
  }
  return '';
}

function BubbleInner({ role, content, typing }: Props) {
  const rowCls = `msg${role === 'user' ? ' user' : ''}`;
  const avCls = `avatar ${role === 'user' ? 'user' : 'ai'}`;
  const glossary = useGlossary();
  const actions = useChatActions();
  // rehype-плагины — стабильный массив, иначе react-markdown пере-парсит
  // на каждый ререндер. При появлении glossary массив пересоздаётся один
  // раз — это ожидаемый ререндер (тултипы появляются).
  const rehypePlugins = useMemo(
    () =>
      glossary
        ? [rehypeHljsMini, () => rehypeGlossary(glossary)]
        : [rehypeHljsMini],
    [glossary],
  );

  const components = useMemo(
    () => ({
      pre: ({ children }: { children?: ReactNode }) => {
        const code = extractText(children);
        return (
          <div className="code-wrap">
            <pre>{children}</pre>
            {actions && (
              <button
                type="button"
                className="code-explain-btn"
                onClick={() => actions.onExplainCode(code)}
              >
                🔍 Разобрать
              </button>
            )}
          </div>
        );
      },
    }),
    [actions],
  );

  return (
    <div className={rowCls}>
      <div className={avCls}>{role === 'user' ? '👤' : '🤖'}</div>
      <div className="bubble">
        {typing && content === '' ? (
          <div className="typing">
            <span />
            <span />
            <span />
          </div>
        ) : role === 'user' ? (
          // юзерский текст — plain text, как и в legacy
          <>{content}</>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={rehypePlugins}
            components={components}
          >
            {content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

// Мемоизация по role+content. Все «спокойные» пузыри ререндерятся 0 раз
// за стрим, нагрузка остаётся только на последнем (его content меняется).
export const Bubble = memo(BubbleInner);
