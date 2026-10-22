import { seededRng, shuffleAnswers } from "./exam";
import { truncate } from "./text";
import { withUtm } from "./share";

/** Ограничения Telegram для quiz-опросов (sendPoll). */
export const POLL_LIMITS = { question: 300, option: 100, explanation: 200, minOptions: 2, maxOptions: 10 };

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

/** Номер дня по московскому времени: не меняется в течение суток для всех запусков. */
export function dayNumber(now: Date): number {
  return Math.floor((now.getTime() + 3 * 3600_000) / 86400_000);
}

/**
 * Вопрос дня: подходящие вопросы идут в постоянном «случайном» порядке (одинаковом при каждом запуске),
 * в день N берём N-й. Повторы начинаются, только когда пройдены все вопросы.
 */
export function pickDailyQuestion(candidates: readonly PollCandidate[], now: Date): PollCandidate | null {
  const pool = candidates.filter(isPollable).sort((a, b) => a.id - b.id);
  if (pool.length === 0) return null;
  const rng = seededRng(20261023);
  const order = pool.map((c, i) => ({ c, k: rng() + i * 1e-9 })).sort((a, b) => a.k - b.k);
  return order[((dayNumber(now) % order.length) + order.length) % order.length]!.c;
}

export type PollRequest = {
  chat_id: string;
  question: string;
  options: string[];
  type: "quiz";
  is_anonymous: true;
  correct_option_id: number;
  explanation?: string;
  reply_markup: { inline_keyboard: { text: string; url: string }[][] };
};

export function buildPollRequest(c: PollCandidate, chatId: string, siteUrl: string, now: Date): PollRequest {
  const answers = shuffleAnswers(c.answers, seededRng(dayNumber(now)));
  const url = withUtm(`${siteUrl.replace(/\/$/, "")}/${c.areaSlug}/q/${c.slug}`, "telegram");
  const req: PollRequest = {
    chat_id: chatId,
    question: c.text,
    options: answers.map((a) => a.text),
    type: "quiz",
    is_anonymous: true,
    correct_option_id: answers.findIndex((a) => a.isCorrect),
    reply_markup: { inline_keyboard: [[{ text: "Разбор и тренажёр на сайте", url }]] },
  };
  if (c.normRef) req.explanation = truncate(`Норма: ${c.normRef}`, POLL_LIMITS.explanation);
  return req;
}
