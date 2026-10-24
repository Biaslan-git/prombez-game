// Отправка викторины подписчику: по команде и после выбора областей при первом старте.
import { api, db } from "sdk";
import { eq } from "sdk/db";
import { subscribers } from "../schema.js";
import { buildPoll, dayNumber } from "./daily.js";
import { pickQuestion } from "./pool.js";
import { areasOf, getSubscriber } from "./subscriber.js";
import { TEXTS } from "./texts.js";

// random=false — вопрос дня, true — случайный вопрос по команде /question.
export async function sendQuestion(chatId, random = false) {
  const sub = await getSubscriber(chatId);
  const areas = areasOf(sub);
  if (!areas.length) {
    await api.sendMessage({ chat_id: chatId, text: TEXTS.nothingSelected });
    return false;
  }
  const now = new Date();
  const q = await pickQuestion(areas, chatId, now, random);
  if (!q) {
    await api.sendMessage({ chat_id: chatId, text: TEXTS.noQuestion });
    return false;
  }
  const poll = buildPoll(q, chatId, now, random ? Math.random : undefined, sub?.lastPos ?? null);
  console.log("quiz sent", { random, area: q.areaSlug, pos: poll.correct_option_id, n: poll.options.length });
  await api.sendPoll(poll);
  if (sub)
    await db.update(subscribers).set({ lastPos: poll.correct_option_id }).where(eq(subscribers.chatId, chatId)).run();
  return true;
}

/** Вопрос дня, если подписчик его сегодня ещё не получал; день отмечается, чтобы утренняя рассылка не прислала второй. */
export async function sendTodayIfDue(chatId) {
  const sub = await getSubscriber(chatId);
  const day = dayNumber(new Date());
  if (!sub?.active || sub.lastSentDay === day) return false;
  if (!(await sendQuestion(chatId))) return false;
  await db.update(subscribers).set({ lastSentDay: day }).where(eq(subscribers.chatId, chatId)).run();
  return true;
}
