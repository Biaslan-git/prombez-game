import type { AreaProgress, QuestionProgress } from "./types";

/** Освоен: ячейка ≥ 3 и последний ответ верный. */
export function isMastered(p: QuestionProgress | undefined): boolean {
  return !!p && p.box >= 3 && p.lastResults[p.lastResults.length - 1] === true;
}

/** Ошибка для «Работы над ошибками»: были неверные ответы среди последних и вопрос ещё не закреплён. */
export function isMistake(p: QuestionProgress | undefined): boolean {
  return !!p && p.box < 3 && p.lastResults.includes(false);
}

/**
 * Вклад вопроса в готовность, от 0 до 1: ячейка до 3 частями, при неверном последнем ответе — 0.
 * Только «освоенные» (ячейка 3 бывает не раньше второго дня: у ячейки 2 интервал сутки) давали 0% весь первый день.
 */
export function readinessCredit(p: QuestionProgress | undefined): number {
  if (!p || p.lastResults[p.lastResults.length - 1] !== true) return 0;
  return Math.min(p.box, 3) / 3;
}

/** Процент без обнуления первых шагов: любой верный ответ даёт хотя бы 1%. */
function toPercent(credit: number, total: number): number {
  if (total <= 0 || credit <= 0) return 0;
  return Math.min(100, Math.max(1, Math.round((credit / total) * 100)));
}

export function readiness(progress: AreaProgress, activeIds: readonly number[]): number {
  let credit = 0;
  for (const id of activeIds) credit += readinessCredit(progress.questions[id]);
  return toPercent(credit, activeIds.length);
}

export type AreaStats = { total: number; studied: number; mastered: number; mistakes: number; readiness: number };

export function areaStats(progress: AreaProgress, activeIds: readonly number[]): AreaStats {
  let studied = 0;
  let mastered = 0;
  let mistakes = 0;
  let credit = 0;
  for (const id of activeIds) {
    const p = progress.questions[id];
    if (!p) continue;
    studied++;
    if (isMastered(p)) mastered++;
    if (isMistake(p)) mistakes++;
    credit += readinessCredit(p);
  }
  return {
    total: activeIds.length,
    studied,
    mastered,
    mistakes,
    readiness: toPercent(credit, activeIds.length),
  };
}

/** Готовность без списка активных id (карточки на главной): по всем сохранённым вопросам, не больше 100. */
export function approxReadiness(progress: AreaProgress, total: number): number {
  const credit = Object.values(progress.questions).reduce((sum, p) => sum + readinessCredit(p), 0);
  return toPercent(credit, total);
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
