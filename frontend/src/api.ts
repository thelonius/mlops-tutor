import type { CurriculumPayload } from './types';

export async function fetchCurriculum(): Promise<CurriculumPayload> {
  const res = await fetch('/api/curriculum');
  if (!res.ok) throw new Error(`curriculum ${res.status}`);
  return res.json();
}
