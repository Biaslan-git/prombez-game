// Сообщения пользователей: /start подписывает на вопрос дня, /settings — выбор областей, /stop удаляет подписку.
import { api, db } from "sdk";
import { eq } from "sdk/db";
import { subscribers } from "../schema.js";
import { sendQuestion, sendTodayIfDue } from "../lib/send.js";
import { describeSelection, findArea, mainMenu, selectedAreas } from "../lib/settings.js";
import { areasOf, getSubscriber } from "../lib/subscriber.js";
import { TEXTS, parseCommand, startArea } from "../lib/texts.js";

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
      // Первый раз и не со страницы области: сначала выбор сфер, вопрос дня придёт после «Готово».
      if (!sub && !fromSite) {
        await api.sendMessage({ chat_id: chatId, text: TEXTS.welcomeChoose });
        await api.sendMessage({ chat_id: chatId, ...mainMenu(selectedAreas(areas)) });
        return;
      }
      await api.sendMessage({
        chat_id: chatId,
        text: TEXTS.welcome(describeSelection(selectedAreas(areas))),
        reply_markup: { inline_keyboard: [[{ text: TEXTS.settingsButton, callback_data: "open" }]] },
      });
      await sendTodayIfDue(chatId);
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
