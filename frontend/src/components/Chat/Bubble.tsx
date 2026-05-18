import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
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
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
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
