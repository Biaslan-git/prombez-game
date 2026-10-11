import type { Box, QuestionProgress } from "./types";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Интервал до следующего показа по ячейке, в днях. Ячейка 1 — в этой же сессии. */
export const BOX_INTERVAL_DAYS: Record<Box, number> = { 0: 0, 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };

export const LAST_RESULTS_SIZE = 3;

export function applyAnswer(prev: QuestionProgress | undefined, correct: boolean, now: number): QuestionProgress {
  const box: Box = correct ? (Math.min((prev?.box ?? 0) + 1, 5) as Box) : 1;
  return {
    box,
    attempts: (prev?.attempts ?? 0) + 1,
    wrong: (prev?.wrong ?? 0) + (correct ? 0 : 1),
    lastAnsweredAt: now,
    nextReviewAt: now + BOX_INTERVAL_DAYS[box] * DAY_MS,
    lastResults: [...(prev?.lastResults ?? []), correct].slice(-LAST_RESULTS_SIZE),
  };
}
