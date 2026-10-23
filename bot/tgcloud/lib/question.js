import { buildPoll, pickDailyQuestion, pickRandomQuestion } from "./daily.js";

/**
 * Викторина для отправки: random=false — вопрос дня (один для всех), random=true — случайный вопрос,
 * не совпадающий с вопросом дня (команда /question). lastPos — позиция верного ответа в прошлой викторине подписчика.
 */
export function composeQuiz({ questions, chatId, now, random = false, lastPos = null, rng = Math.random }) {
  const daily = pickDailyQuestion(questions, now);
  const q = random ? pickRandomQuestion(questions, daily?.id, rng) : daily;
  if (!q) return null;
  return buildPoll(q, chatId, now, random ? rng : undefined, lastPos);
}
