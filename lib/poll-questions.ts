/**
 * Вопросы для викторины в Telegram-боте «Вопрос дня». Бот работает на Telegram Serverless (см. bot/) и получает
 * вопросы в свою базу через scripts/sync-bot.mjs (GET /api/telegram/questions?area=…).
 */

/** Ограничения Telegram для quiz-опросов (sendPoll). */
export const POLL_LIMITS = { question: 300, option: 100, minOptions: 2, maxOptions: 10 };

export type PollCandidate = {
  id: number;
  areaSlug: string;
  slug: string;
  text: string;
  normRef: string | null;
  answers: { text: string; isCorrect: boolean }[];
};

/** Подходит ли вопрос для опроса: один верный ответ, всё укладывается в лимиты Telegram. */
export function isPollable(c: PollCandidate): boolean {
  const n = c.answers.length;
  return (
    c.text.length <= POLL_LIMITS.question &&
    n >= POLL_LIMITS.minOptions &&
    n <= POLL_LIMITS.maxOptions &&
    c.answers.filter((a) => a.isCorrect).length === 1 &&
    c.answers.every((a) => a.text.length <= POLL_LIMITS.option)
  );
}
