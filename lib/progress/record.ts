import { applyAnswer } from "./leitner";
import { registerDailyAnswer } from "./streak";
import type { AreaProgress, ExamRecord } from "./types";

export const MAX_EXAMS_STORED = 50;

/** Применяет ответ на вопрос к прогрессу области (тренировка и экзамен обновляют одинаково). */
export function recordAnswer(p: AreaProgress, questionId: number, correct: boolean, now: number): AreaProgress {
  return {
    ...p,
    questions: { ...p.questions, [questionId]: applyAnswer(p.questions[questionId], correct, now) },
    ...registerDailyAnswer(p, now),
  };
}

export function recordExam(
  p: AreaProgress,
  results: { questionId: number; correct: boolean }[],
  exam: ExamRecord,
): AreaProgress {
  let next = p;
  for (const r of results) next = recordAnswer(next, r.questionId, r.correct, exam.at);
  return { ...next, exams: [...next.exams, exam].slice(-MAX_EXAMS_STORED) };
}
