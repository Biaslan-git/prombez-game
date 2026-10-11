export type ExamAnswer = { id: number; text: string; isCorrect: boolean };
export type ExamQuestion = { id: number; number: number; text: string; answers: ExamAnswer[] };

export type Ticket<Q extends ExamQuestion = ExamQuestion> = {
  questions: Q[];
  startedAt: number;
  timeLimitMs: number;
  passThreshold: number;
};

/** Ответы пользователя: questionId → выбранные answerId. */
export type Responses = Record<number, number[]>;

export type ExamMistake<Q extends ExamQuestion = ExamQuestion> = { question: Q; selected: number[] };
export type ExamResult<Q extends ExamQuestion = ExamQuestion> = {
  correct: number;
  total: number;
  passed: boolean;
  perQuestion: { questionId: number; correct: boolean }[];
  mistakes: ExamMistake<Q>[];
};

export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Детерминированный ГПСЧ (mulberry32) — для тестов и воспроизводимых билетов. */
export function seededRng(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Билет: случайные `count` вопросов области (или все, если их меньше), порядок ответов перемешан.
 * Порог сдачи масштабируется, если вопросов в банке меньше, чем в регламенте.
 */
export function generateTicket<Q extends ExamQuestion>(
  pool: readonly Q[],
  opts: { count: number; timeLimitMin: number; passThreshold: number; now: number },
  rng: Rng = Math.random,
): Ticket<Q> {
  const count = Math.max(0, Math.min(opts.count, pool.length));
  const picked = shuffle(pool, rng)
    .slice(0, count)
    .map((q) => ({ ...q, answers: shuffle(q.answers, rng) }));
  const threshold =
    count < opts.count && opts.count > 0 ? Math.ceil((opts.passThreshold / opts.count) * count) : opts.passThreshold;
  return {
    questions: picked,
    startedAt: opts.now,
    timeLimitMs: opts.timeLimitMin * 60_000,
    passThreshold: Math.min(threshold, count),
  };
}

export function isAnswerCorrect(q: ExamQuestion, selected: readonly number[] | undefined): boolean {
  if (!selected || selected.length === 0) return false;
  const correct = q.answers.filter((a) => a.isCorrect).map((a) => a.id);
  const chosen = new Set(selected);
  return chosen.size === correct.length && correct.every((id) => chosen.has(id));
}

export function scoreExam<Q extends ExamQuestion>(ticket: Ticket<Q>, responses: Responses): ExamResult<Q> {
  const perQuestion = ticket.questions.map((q) => ({ questionId: q.id, correct: isAnswerCorrect(q, responses[q.id]) }));
  const correct = perQuestion.filter((r) => r.correct).length;
  const mistakes = ticket.questions
    .filter((_, i) => !perQuestion[i]!.correct)
    .map((question) => ({ question, selected: responses[question.id] ?? [] }));
  return {
    correct,
    total: ticket.questions.length,
    passed: ticket.questions.length > 0 && correct >= ticket.passThreshold,
    perQuestion,
    mistakes,
  };
}

export function remainingMs(ticket: Ticket, now: number): number {
  return Math.max(0, ticket.startedAt + ticket.timeLimitMs - now);
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
