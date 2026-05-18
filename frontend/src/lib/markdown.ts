import { marked } from 'marked';

// Фильтр CJK-иероглифов (баг Llama 8B). Сохраняем часть ДО первого
// иероглифа если она >= 3 символов, остальное (CJK + хвост) убираем.
// Перенесено 1-в-1 из legacy stripCJK.
export function stripCJK(text: string): string {
  return text
    .replace(
      /([^\s]*?)([㐀-鿿豈-﫿぀-ヿ]+\S*)/g,
      (_, pre: string) => (pre.length >= 3 ? pre : ''),
    )
    .replace(/ {2,}/g, ' ');
}

// Inline-markdown для cheatsheet: **bold**, `code`, [link](url) и т.п.
// Возвращает HTML-строку, дальше используется через dangerouslySetInnerHTML.
// Безопасно потому что источник — curriculum.py (наш собственный контент).
export function csInline(s: unknown): string {
  if (typeof s !== 'string') return '';
  try {
    return marked.parseInline(stripCJK(s)) as string;
  } catch {
    return csEscape(s);
  }
}

export function csEscape(s: string | undefined | null): string {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Блочный markdown для tldr/callout — те же опции что marked.parse в legacy.
export function csBlock(md: string): string {
  return marked.parse(stripCJK(md), { async: false }) as string;
}
