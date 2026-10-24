// Кнопки меню /settings: выбор сфер и областей для вопроса дня.
import { api } from "sdk";
import { applyCallback, courseMenu, describeSelection, mainMenu } from "../lib/settings.js";
import { sendTodayIfDue } from "../lib/send.js";
import { areasOf, getSubscriber, saveAreas } from "../lib/subscriber.js";
import { TEXTS } from "../lib/texts.js";

function render(list, view) {
  if (view.menu === "course") return courseMenu(list, view.course, view.page);
  if (view.menu === "done")
    return {
      text: list.length ? TEXTS.saved(describeSelection(list)) : TEXTS.nothingSelected,
      reply_markup: { inline_keyboard: [] },
    };
  return mainMenu(list);
}

export default async function onCallbackQuery(cq) {
  const chatId = cq.message?.chat?.id;
  if (!chatId || cq.message.chat.type !== "private") {
    await api.answerCallbackQuery({ callback_query_id: cq.id });
    return;
  }
  const before = areasOf(await getSubscriber(chatId));
  const { list, view } = applyCallback(before, cq.data);
  await api.answerCallbackQuery({ callback_query_id: cq.id });
  if (!view) return;
  if (list !== before) await saveAreas(chatId, list);

  const menu = render(list, view);
  // Кнопка под приветствием открывает меню новым сообщением, остальные правят само меню.
  if (cq.data === "open") {
    await api.sendMessage({ chat_id: chatId, ...menu });
    return;
  }
  try {
    await api.editMessageText({ chat_id: chatId, message_id: cq.message.message_id, ...menu });
  } catch (e) {
    if (!(e.code === 400 && /not modified/i.test(e.description ?? ""))) throw e;
  }
  // После первого выбора областей (при /start) сразу присылаем вопрос дня.
  if (view.menu === "done" && list.length) await sendTodayIfDue(chatId);
}
