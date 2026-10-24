// Сообщения пользователей: /start подписывает на вопрос дня, /settings — выбор областей, /stop удаляет подписку.
import { api, db } from "sdk";
import { eq } from "sdk/db";
import { subscribers } from "../schema.js";
import { buildPoll, dayNumber } from "../lib/daily.js";
import { pickQuestion } from "../lib/pool.js";
import { describeSelection, findArea, mainMenu, selectedAreas } from "../lib/settings.js";
import { areasOf, getSubscriber } from "../lib/subscriber.js";
import { TEXTS, parseCommand, startArea } from "../lib/texts.js";

// random=false — вопрос дня, true — случайный вопрос по команде /question.
async function sendQuestion(chatId, random = false) {
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

export default async function onMessage(message) {
  if (message.chat?.type !== "private") return;
  const chatId = message.chat.id;
  const username = message.from?.username ?? null;

  switch (parseCommand(message.text)) {
    case "start": {
      // С сайта можно прийти со страницы области (/start a_<slug>): добавляем её к выбору.
      const sub = await getSubscriber(chatId);
      const fromSite = findArea(startArea(message.text) ?? "");
      let areas = sub?.areas ?? null;
      if (fromSite) areas = Array.isArray(areas) ? [...new Set([...areas, fromSite.slug])] : [fromSite.slug];
      await db
        .insert(subscribers)
        .values({ chatId, username, active: true, areas })
        .onConflictDoUpdate({ target: subscribers.chatId, set: { active: true, username, areas } })
        .run();
      await api.sendMessage({
        chat_id: chatId,
        text: TEXTS.welcome(describeSelection(selectedAreas(areas))),
        reply_markup: { inline_keyboard: [[{ text: TEXTS.settingsButton, callback_data: "open" }]] },
      });
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
    case "settings": {
      const menu = mainMenu(areasOf(await getSubscriber(chatId)));
      await api.sendMessage({ chat_id: chatId, ...menu });
      return;
    }
    case "question":
      await sendQuestion(chatId, true);
      return;
    case "stop":
      await db.delete(subscribers).where(eq(subscribers.chatId, chatId)).run();
      await api.sendMessage({ chat_id: chatId, text: TEXTS.stopped });
      return;
    default:
      await api.sendMessage({ chat_id: chatId, text: TEXTS.help });
  }
}
