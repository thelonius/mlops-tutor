import { useEffect, type RefObject } from 'react';
import { useGlossary } from '../components/Glossary/GlossaryProvider';

// Сканирует поддерево DOM и оборачивает совпадения терминов в
// <span class="gloss-term" data-tooltip="...">. Используется в местах,
// где markdown рендерится через dangerouslySetInnerHTML (Cheatsheet) —
// там rehype-glossary не применим. Аналог legacy addTooltips(view).
export function useGlossaryDom(ref: RefObject<HTMLElement | null>, deps: unknown[]): void {
  const glossary = useGlossary();
  useEffect(() => {
    const root = ref.current;
    if (!root || !glossary) return;
    const { regex, lookup } = glossary;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        let p: HTMLElement | null = node.parentElement;
        while (p && p !== root) {
          const tag = p.tagName;
          if (tag === 'CODE' || tag === 'PRE' || tag === 'A') return NodeFilter.FILTER_REJECT;
          if (p.classList.contains('gloss-term')) return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes: Text[] = [];
    let n = walker.nextNode();
    while (n) {
      nodes.push(n as Text);
      n = walker.nextNode();
    }

    for (const tn of nodes) {
      const text = tn.nodeValue ?? '';
      regex.lastIndex = 0;
      if (!regex.test(text)) continue;
      regex.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text))) {
        if (m.index > last) {
          frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        }
        const span = document.createElement('span');
        span.className = 'gloss-term';
        span.textContent = m[0];
        const def = lookup(m[0]);
        if (def) span.dataset.tooltip = def;
        frag.appendChild(span);
        last = m.index + m[0].length;
      }
      if (last < text.length) {
        frag.appendChild(document.createTextNode(text.slice(last)));
      }
      tn.parentNode?.replaceChild(frag, tn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glossary, ...deps]);
}
