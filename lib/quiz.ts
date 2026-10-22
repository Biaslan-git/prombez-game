import { seededRng, shuffle } from "./exam";
import { topicsFor } from "./topics";

function topicSlugs(text: string): Set<string> {
  return new Set(topicsFor(text).map((t) => t.slug));
}

/**
 * Вопросы для мини-теста под страницей вопроса: сначала из тех же тем, потом любые другие.
 * Выбор детерминирован (seed = id текущего вопроса): ISR-страница не меняется между пересборками.
 */
export function pickQuizQuestions<Q extends { id: number; text: string }>(
  all: readonly Q[],
  current: { id: number; text: string },
  n = 10,
): Q[] {
  const mine = topicSlugs(current.text);
  const others = all.filter((q) => q.id !== current.id);
  const related = others.filter((q) => topicsFor(q.text).some((t) => mine.has(t.slug)));
  const relatedIds = new Set(related.map((q) => q.id));
  const rest = others.filter((q) => !relatedIds.has(q.id));
  const rng = seededRng(current.id);
  return [...shuffle(related, rng), ...shuffle(rest, rng)].slice(0, n);
}

export const QUIZ_ROUND = 5;

/** Вопросы раунда: раунды идут по кругу, если вопросов не хватает на новый — начинаем сначала. */
export function quizRound<Q>(questions: readonly Q[], round: number, size = QUIZ_ROUND): Q[] {
  if (questions.length <= size) return [...questions];
  const rounds = Math.ceil(questions.length / size);
  const start = (round % rounds) * size;
  return questions.slice(start, start + size);
}
