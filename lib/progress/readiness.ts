import type { AreaProgress, QuestionProgress } from "./types";

/** Освоен: ячейка ≥ 3 и последний ответ верный. */
export function isMastered(p: QuestionProgress | undefined): boolean {
  return !!p && p.box >= 3 && p.lastResults[p.lastResults.length - 1] === true;
}

/** Ошибка для «Работы над ошибками»: были неверные ответы среди последних и вопрос ещё не закреплён. */
export function isMistake(p: QuestionProgress | undefined): boolean {
  return !!p && p.box < 3 && p.lastResults.includes(false);
}

export function readiness(progress: AreaProgress, activeIds: readonly number[]): number {
  if (activeIds.length === 0) return 0;
  const mastered = activeIds.filter((id) => isMastered(progress.questions[id])).length;
  return Math.round((mastered / activeIds.length) * 100);
}

export type AreaStats = { total: number; studied: number; mastered: number; mistakes: number; readiness: number };

export function areaStats(progress: AreaProgress, activeIds: readonly number[]): AreaStats {
  let studied = 0;
  let mastered = 0;
  let mistakes = 0;
  for (const id of activeIds) {
    const p = progress.questions[id];
    if (!p) continue;
    studied++;
    if (isMastered(p)) mastered++;
    if (isMistake(p)) mistakes++;
  }
  return {
    total: activeIds.length,
    studied,
    mastered,
    mistakes,
    readiness: activeIds.length ? Math.round((mastered / activeIds.length) * 100) : 0,
  };
}

/** Готовность без списка активных id (карточки на главной): освоенные из сохранённых, не больше total. */
export function approxReadiness(progress: AreaProgress, total: number): number {
  if (total <= 0) return 0;
  const mastered = Object.values(progress.questions).filter(isMastered).length;
  return Math.min(100, Math.round((mastered / total) * 100));
}

export function readinessLabel(pct: number): string {
  if (pct >= 90) return "Готовы к экзамену";
  if (pct >= 70) return "Почти готовы";
  if (pct >= 40) return "Уже неплохо";
  return "Только начали";
}

export function mistakeIds(progress: AreaProgress, orderedIds: readonly number[]): number[] {
  return orderedIds.filter((id) => isMistake(progress.questions[id]));
}
