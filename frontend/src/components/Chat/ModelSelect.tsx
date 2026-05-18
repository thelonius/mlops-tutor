import { useStore } from '../../state/store';

// Список моделей дублирует app.py:MODELS — порядок и идентификаторы важны
// (бэкенд использует preferred модель как старт chain'а).
const MODELS = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
  { id: 'qwen/qwen3-32b', label: 'Qwen3 32B' },
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
  { id: 'gemma-4-31b-it', label: 'Gemma 4 31B' },
  { id: 'gemma-4-26b-a4b-it', label: 'Gemma 4 26B' },
];

export function ModelSelect() {
  const { state, dispatch } = useStore();
  return (
    <select
      id="model-select"
      title="Модель"
      value={state.preferredModel}
      onChange={(e) => dispatch({ type: 'SET_MODEL', model: e.target.value })}
    >
      {MODELS.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
