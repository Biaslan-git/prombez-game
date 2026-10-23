import { seededRng, shuffleAnswers } from "./rng.js";

export const SITE_URL = "https://prombez-game.ru";

/** Номер дня по московскому времени: одинаков для всех запусков в течение суток. */
export function dayNumber(now) {
  return Math.floor((now.getTime() + 3 * 3600_000) / 86400_000);
}

/**
 * Вопрос дня: вопросы идут в постоянном «случайном» порядке (одинаковом при каждом запуске),
 * в день N берём N-й. Повторы начинаются, только когда пройдены все вопросы.
 */
export function pickDailyQuestion(questions, now) {
  if (!questions.length) return null;
  const pool = [...questions].sort((a, b) => a.id - b.id);
  const rng = seededRng(20261023);
  const order = pool.map((q, i) => ({ q, k: rng() + i * 1e-9 })).sort((a, b) => a.k - b.k);
  return order[((dayNumber(now) % order.length) + order.length) % order.length].q;
}

function truncate(s, max) {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

/** Запрос sendPoll: викторина с пояснением (норма) и кнопкой на страницу вопроса. */
export function buildPoll(q, chatId, now) {
  const answers = shuffleAnswers(q.answers, seededRng(dayNumber(now)));
  const poll = {
    chat_id: chatId,
    question: q.text,
    options: answers.map((a) => a.text),
    type: "quiz",
    is_anonymous: true,
    correct_option_id: answers.findIndex((a) => a.isCorrect),
    reply_markup: {
      inline_keyboard: [
        [{ text: "Разбор и тренажёр на сайте", url: `${SITE_URL}/${q.areaSlug}/q/${q.slug}?utm_source=telegram` }],
      ],
    },
  };
  if (q.normRef) poll.explanation = truncate(`Норма: ${q.normRef}`, 200);
  return poll;
}
