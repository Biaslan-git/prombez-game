export type Box = 0 | 1 | 2 | 3 | 4 | 5;

export type QuestionProgress = {
  box: Box; // ячейка Лейтнера
  attempts: number;
  wrong: number;
  lastAnsweredAt: number; // ms
  nextReviewAt: number; // ms
  lastResults: boolean[]; // последние 3 результата, последний — в конце
};

export type ExamRecord = { at: number; correct: number; total: number; passed: boolean };

export type AreaProgress = {
  version: 1;
  questions: Record<number /* questionId */, QuestionProgress>;
  exams: ExamRecord[];
  streak: { lastDay: string /* YYYY-MM-DD */; days: number };
  /** Счётчик ответов за текущий день — нужен для засчёта дня в серию. */
  daily: { day: string; count: number };
};

export function emptyAreaProgress(): AreaProgress {
  return { version: 1, questions: {}, exams: [], streak: { lastDay: "", days: 0 }, daily: { day: "", count: 0 } };
}
