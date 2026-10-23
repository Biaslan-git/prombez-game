// Сообщения пользователей: /start подписывает на вопрос дня, /stop удаляет подписку.
import { api, db } from "sdk";
import { eq } from "sdk/db";
import { subscribers } from "../schema.js";
import { QUESTIONS } from "../lib/questions.js";
import { buildPoll, dayNumber, pickDailyQuestion } from "../lib/daily.js";
import { TEXTS, parseCommand } from "../lib/texts.js";

async function sendQuestion(chatId) {
  const now = new Date();
  const q = pickDailyQuestion(QUESTIONS, now);
  if (!q) {
    await api.sendMessage({ chat_id: chatId, text: TEXTS.noQuestion });
    return false;
  }
  await api.sendPoll(buildPoll(q, chatId, now));
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
