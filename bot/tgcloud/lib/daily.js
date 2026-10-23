import { isPinnedLast, seededRng, shuffleAnswers } from "./rng.js";

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

/** Случайный вопрос для команды /question (не тот, что уже выпал, если вопросов больше одного). */
export function pickRandomQuestion(questions, excludeId, rng = Math.random) {
  const pool = questions.length > 1 ? questions.filter((q) => q.id !== excludeId) : questions;
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}

/**
 * Верный вариант не должен подряд попадать на одну позицию: если он стоит там же, где в прошлой викторине
 * подписчика (avoidPos), меняем его местами со случайным вариантом, который не прибит к концу.
 */
function moveCorrectFrom(answers, avoidPos, rng) {
  const idx = answers.findIndex((a) => a.isCorrect);
  if (avoidPos == null || idx !== avoidPos || isPinnedLast(answers[idx])) return answers;
  const candidates = answers.map((_, i) => i).filter((i) => i !== idx && !isPinnedLast(answers[i]));
  if (!candidates.length) return answers;
  const j = candidates[Math.floor(rng() * candidates.length)];
  const out = [...answers];
  [out[idx], out[j]] = [out[j], out[idx]];
  return out;
}

/**
 * Запрос sendPoll: викторина с пояснением (норма) и кнопкой на страницу вопроса.
 * Порядок вариантов для вопроса дня задаётся датой и номером вопроса (одинаков для всех подписчиков),
 * для /question можно передать другой rng. avoidPos — позиция верного ответа в прошлой викторине подписчика.
 */
export function buildPoll(
  q,
  chatId,
  now,
  rng = seededRng((Math.imul(dayNumber(now), 2654435761) + q.id) >>> 0),
  avoidPos = null,
) {
  const answers = moveCorrectFrom(shuffleAnswers(q.answers, rng), avoidPos, rng);
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
