import type { CurriculumPayload } from './types';

export async function fetchCurriculum(): Promise<CurriculumPayload> {
  const res = await fetch('/api/curriculum');
  if (!res.ok) throw new Error(`curriculum ${res.status}`);
  return res.json();
}

export async function fetchVacancyCurriculum(vacancyId: string): Promise<CurriculumPayload & { vacancy: any }> {
  const res = await fetch(`/api/curriculum/vacancy/${vacancyId}`);
  if (!res.ok) throw new Error(`vacancy curriculum ${res.status}`);
  return res.json();
}
