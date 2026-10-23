// Сообщения пользователей: /start подписывает на вопрос дня, /stop удаляет подписку.
import { api, db } from "sdk";
import { eq } from "sdk/db";
import { subscribers } from "../schema.js";
import { QUESTIONS } from "../lib/questions.js";
import { buildPoll, dayNumber, pickDailyQuestion } from "../lib/daily.js";
import { TEXTS, parseCommand } from "../lib/texts.js";

// random=false — вопрос дня (одинаковый для всех), true — случайный вопрос по команде /question.
async function sendQuestion(chatId, random = false) {
  const now = new Date();
  const daily = pickDailyQuestion(QUESTIONS, now);
  const q = random ? pickRandomQuestion(QUESTIONS, daily?.id) : daily;
  if (!q) {
    await api.sendMessage({ chat_id: chatId, text: TEXTS.noQuestion });
    return false;
  }
  const sub = await db.select().from(subscribers).where(eq(subscribers.chatId, chatId)).get();
  const poll = random
    ? buildPoll(q, chatId, now, Math.random, sub?.lastPos ?? null)
    : buildPoll(q, chatId, now, undefined, sub?.lastPos ?? null);
  await api.sendPoll(poll);
  if (sub)
    await db.update(subscribers).set({ lastPos: poll.correct_option_id }).where(eq(subscribers.chatId, chatId)).run();
  return true;
}

export default async function onMessage(message) {
  if (message.chat?.type !== "private") return;
  const chatId = message.chat.id;
  const username = message.from?.username ?? null;

  switch (parseCommand(message.text)) {
    case "start": {
      await db
        .insert(subscribers)
        .values({ chatId, username, active: true })
        .onConflictDoUpdate({ target: subscribers.chatId, set: { active: true, username } })
        .run();
      await api.sendMessage({ chat_id: chatId, text: TEXTS.welcome });
      // Первый вопрос уходит сразу; день отмечаем, чтобы утренняя рассылка не прислала второй.
      if (await sendQuestion(chatId)) {
        await db
          .update(subscribers)
          .set({ lastSentDay: dayNumber(new Date()) })
          .where(eq(subscribers.chatId, chatId))
          .run();
      }
      return;
    }
    case "question":
      await sendQuestion(chatId);
      return;
    case "stop":
      await db.delete(subscribers).where(eq(subscribers.chatId, chatId)).run();
      await api.sendMessage({ chat_id: chatId, text: TEXTS.stopped });
      return;
    default:
      await api.sendMessage({ chat_id: chatId, text: TEXTS.help });
  }
}
