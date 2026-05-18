// Минималистичный rehype-плагин для подсветки кода.
// Аналог rehype-highlight, но с собственной lowlight-инстансой —
// rehype-highlight всегда тянет lowlight `common` (~35 языков, ~300KB).
// Тут регистрируем только то, что реально встречается в MLOps-контенте.
import { visit } from 'unist-util-visit';
import { toText } from 'hast-util-to-text';
import { createLowlight } from 'lowlight';
// Только 6 ходовых для MLOps — python/bash/yaml/json/dockerfile/sql.
// Каждый язык ~10-30KB. Если в кадре всплывёт js/ts код в чате — ляжет
// без подсветки (plaintext). Цена решения: ~100KB gz сэкономлено.
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import yaml from 'highlight.js/lib/languages/yaml';
import json from 'highlight.js/lib/languages/json';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import sql from 'highlight.js/lib/languages/sql';
import plaintext from 'highlight.js/lib/languages/plaintext';
import type { Root, Element, ElementContent } from 'hast';

const lowlight = createLowlight({
  python,
  bash,
  yaml,
  json,
  dockerfile,
  sql,
  plaintext,
});

// Алиасы — частые написания. Если не наш язык, ничего не подсвечиваем.
const ALIASES: Record<string, string> = {
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  Dockerfile: 'dockerfile',
};

function langFromClass(el: Element): string | null {
  const classes = (el.properties?.className as string[] | undefined) ?? [];
  for (const c of classes) {
    if (typeof c !== 'string') continue;
    if (c.startsWith('language-')) {
      const name = c.slice(9);
      return ALIASES[name] ?? name;
    }
  }
  return null;
}

export function rehypeHljsMini() {
  return function transformer(tree: Root) {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'pre') return;
      const code = node.children.find(
        (c): c is Element => c.type === 'element' && c.tagName === 'code',
      );
      if (!code) return;
      const lang = langFromClass(code);
      if (!lang || !lowlight.registered(lang)) return;
      const source = toText(code, { whitespace: 'pre' });
      try {
        const result = lowlight.highlight(lang, source);
        const cls = (code.properties?.className as string[] | undefined) ?? [];
        code.properties = {
          ...code.properties,
          className: [...cls, 'hljs'],
        };
        code.children = result.children as ElementContent[];
      } catch {
        // битый чанк во время стрима — пропускаем, на следующем чанке догонит
      }
    });
  };
}
