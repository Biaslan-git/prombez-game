import { isPinnedLast, seededRng, shuffleAnswers } from "./rng.js";

export const SITE_URL = "https://prombez-game.ru";

/** Номер дня по московскому времени: одинаков для всех запусков в течение суток. */
export function dayNumber(now) {
  return Math.floor((now.getTime() + 3 * 3600_000) / 86400_000);
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Постоянное «случайное» 32-битное число из id чата: параметры порядка вопросов у подписчика. */
function mix(chatId, salt) {
  const x = BigInt(chatId);
  let h = (Number(BigInt.asUintN(32, x)) ^ Math.imul(Number(BigInt.asUintN(32, x >> 32n)), 31) ^ salt) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Номер вопроса дня в пуле из n вопросов (по порядку id): (a·day + b) mod n, где a взаимно просто с n.
 * Так подписчик проходит весь пул без повторов (пока пул не меняется), а у разных подписчиков порядок разный.
 */
export function dailyIndex(n, day, chatId) {
  if (n <= 0) return -1;
  if (n === 1) return 0;
  let a = 1 + (mix(chatId, 0x9e37) % (n - 1));
  while (gcd(a, n) !== 1) a = a + 1 === n ? 1 : a + 1;
  const b = mix(chatId, 0x85eb) % n;
  return Number((BigInt(a) * BigInt(day) + BigInt(b)) % BigInt(n));
}

function truncate(s, max) {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

/** Случайный номер для команды /question: не вопрос дня, если в пуле больше одного вопроса. */
export function randomIndex(n, excludeIndex, rng = Math.random) {
  if (n <= 0) return -1;
  if (n === 1) return 0;
  const k = Math.floor(rng() * (n - 1));
  return excludeIndex >= 0 && k >= excludeIndex ? k + 1 : k;
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
