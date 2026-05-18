export interface FlowBranch {
  condition?: string;
  outcome?: string;
  children?: FlowBranch[];
}

export type CheatsheetBlock =
  | { type: 'tldr'; content?: string }
  | { type: 'code'; code?: string; lang?: string; caption?: string }
  | {
      type: 'table';
      title?: string;
      headers?: string[];
      rows?: string[][];
      note?: string;
    }
  | {
      type: 'compare';
      title?: string;
      items?: { title?: string; points?: string[]; color?: string }[];
    }
  | {
      type: 'list';
      title?: string;
      kind?: 'plain' | 'steps' | 'do' | 'dont';
      items?: string[];
    }
  | { type: 'callout'; kind?: 'warning' | 'tip' | 'fact' | 'gotcha'; content?: string }
  | { type: 'flow'; title?: string; branches?: FlowBranch[] }
  | {
      type: 'matrix';
      title?: string;
      cols?: string[];
      rows?: string[];
      cells?: string[][];
      cellMeta?: { class?: string }[][];
    }
  | { type: 'kv'; title?: string; items?: { k?: string; v?: string }[] };
