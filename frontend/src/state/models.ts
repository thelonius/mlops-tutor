// Канонический список моделей — дублирует app.py:MODELS. Порядок и
// идентификаторы важны: бэкенд использует preferred как старт fallback-chain'а.
export const MODELS = [
  { id: 'glm-4.7-flash', label: 'GLM 4.7 Flash' },
  { id: 'glm-4.5-flash', label: 'GLM 4.5 Flash' },
  { id: 'minimax/minimax-m3:free', label: 'MiniMax M3' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 3 Super 120B' },
  { id: 'z-ai/glm-5.2:free', label: 'GLM 5.2' },
  { id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B' },
  { id: 'z-ai/glm-5.3-flash', label: 'GLM 5.3 Flash (платная)' },
];

export const DEFAULT_MODEL = MODELS[0].id;

export const isKnownModel = (id: string) => MODELS.some((m) => m.id === id);
