import type { AreaProgress } from "./types";

/** Вопрос, отвеченный неверно, возвращается через столько ответов (в пределах 3–5). */
export const WRONG_REPEAT_AFTER = 4;
/** Сколько последних вопросов сессии не показываем повторно (кроме случая, когда больше нечего). */
export const RECENT_WINDOW = 5;

export type SessionState = {
  /** Сколько ответов дано в сессии. */
  answered: number;
  /** Id вопросов в порядке ответов в этой сессии. */
  history: number[];
  /** Запланированные повторы ошибок: показать вопрос, когда answered >= at. */
  repeats: { id: number; at: number }[];
};

export type PickReason = "repeat" | "due" | "new" | "ahead";
export type Pick = { id: number; reason: PickReason } | null;

export function emptySession(): SessionState {
  return { answered: 0, history: [], repeats: [] };
}

export function recordInSession(s: SessionState, id: number, correct: boolean): SessionState {
  const answered = s.answered + 1;
  const repeats = s.repeats.filter((r) => r.id !== id);
  if (!correct) repeats.push({ id, at: answered + WRONG_REPEAT_AFTER });
  return { answered, history: [...s.history, id], repeats };
}

/**
 * Выбор следующего вопроса тренировки:
 * 0. повтор ошибки этой сессии, если подошла его очередь;
 * 1. просроченные (nextReviewAt <= now), сначала с меньшей ячейкой;
 * 2. новые — по порядку номеров (orderedIds уже отсортированы по номеру);
 * 3. всё изучено — вопросы с самым ранним nextReviewAt (reason = "ahead").
 * Недавние вопросы сессии и ожидающие повтора пропускаем, пока есть альтернатива.
 */
export function pickNext(orderedIds: readonly number[], progress: AreaProgress, session: SessionState, now: number): Pick {
  if (orderedIds.length === 0) return null;
  const active = new Set(orderedIds);
  const last = session.history[session.history.length - 1];

  const readyRepeat = session.repeats
    .filter((r) => r.at <= session.answered && active.has(r.id) && r.id !== last)
    .sort((a, b) => a.at - b.at)[0];
  if (readyRepeat) return { id: readyRepeat.id, reason: "repeat" };

  const window = Math.min(RECENT_WINDOW, Math.max(orderedIds.length - 1, 0));
  const recent = new Set(session.history.slice(-window));
  const pending = new Set(session.repeats.map((r) => r.id));
  const blocked = (id: number) => recent.has(id) || pending.has(id);

  const due: number[] = [];
  const fresh: number[] = [];
  for (const id of orderedIds) {
    const p = progress.questions[id];
    if (!p) fresh.push(id);
    else if (p.nextReviewAt <= now) due.push(id);
  }
  const byBoxThenTime = (a: number, b: number) => {
    const pa = progress.questions[a]!;
    const pb = progress.questions[b]!;
    return pa.box - pb.box || pa.nextReviewAt - pb.nextReviewAt;
  };
  due.sort(byBoxThenTime);

  const dueId = due.find((id) => !blocked(id));
  if (dueId !== undefined) return { id: dueId, reason: "due" };
  const newId = fresh.find((id) => !blocked(id));
  if (newId !== undefined) return { id: newId, reason: "new" };

  // Всё изучено и ничего не просрочено (или всё доступное заблокировано недавним показом).
  const byNextReview = [...orderedIds]
    .filter((id) => progress.questions[id])
    .sort((a, b) => progress.questions[a]!.nextReviewAt - progress.questions[b]!.nextReviewAt);
  const ahead = byNextReview.find((id) => !blocked(id)) ?? byNextReview.find((id) => id !== last) ?? orderedIds[0]!;
  const isDueOrNew = due.includes(ahead) || fresh.includes(ahead);
  return { id: ahead, reason: isDueOrNew ? (due.includes(ahead) ? "due" : "new") : "ahead" };
}

/**
 * Режим «Работа над ошибками»: снимок списка ошибок на старте; вопрос уходит из очереди,
 * когда на него ответили верно в этой сессии. Неверный ответ — повтор через несколько вопросов.
 */
export function pickNextMistake(
  snapshot: readonly number[],
  progress: AreaProgress,
  session: SessionState,
  solved: ReadonlySet<number>,
): number | null {
  const left = snapshot.filter((id) => !solved.has(id));
  if (left.length === 0) return null;
  const last = session.history[session.history.length - 1];
  const readyRepeat = session.repeats
    .filter((r) => r.at <= session.answered && !solved.has(r.id) && r.id !== last)
    .sort((a, b) => a.at - b.at)[0];
  if (readyRepeat) return readyRepeat.id;
  const pending = new Set(session.repeats.map((r) => r.id));
  const untouched = left
    .filter((id) => !pending.has(id) && id !== last)
    .sort((a, b) => (progress.questions[a]?.box ?? 0) - (progress.questions[b]?.box ?? 0));
  if (untouched[0] !== undefined) return untouched[0];
  // Остались только ожидающие повтора — показываем ближайший, но не тот же самый подряд.
  const soonest = session.repeats
    .filter((r) => !solved.has(r.id))
    .sort((a, b) => a.at - b.at)
    .find((r) => r.id !== last);
  return soonest?.id ?? left[0]!;
}
