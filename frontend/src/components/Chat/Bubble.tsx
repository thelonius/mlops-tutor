import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { rehypeHljsMini } from '../../lib/rehype-hljs-mini';
import { rehypeGlossary } from '../../lib/rehype-glossary';
import { useGlossary } from '../Glossary/GlossaryProvider';
import type { Role } from '../../types';

interface Props {
  role: Role;
  content: string;
  // typing=true показывает '...' пока контент пустой (стрим стартовал, но
  // первый ev_text ещё не пришёл).
  typing?: boolean;
}

function BubbleInner({ role, content, typing }: Props) {
  const rowCls = `msg${role === 'user' ? ' user' : ''}`;
  const avCls = `avatar ${role === 'user' ? 'user' : 'ai'}`;
  const glossary = useGlossary();
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
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={rehypePlugins}>
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
