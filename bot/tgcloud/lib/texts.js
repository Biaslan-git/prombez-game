export const TEXTS = {
  welcome: (selection) =>
    "Привет! Каждый день в 9:00 по Москве я буду присылать один вопрос из банков для подготовки к аттестации: выберите ответ и сразу узнаете результат.\n\n" +
    `Вопросы сейчас: ${selection}.\n\n` +
    "/settings — выбрать сферы и области\n/question — вопрос прямо сейчас\n/stop — отключить рассылку\n\nВот вопрос на сегодня 👇",
  stopped: "Рассылка отключена, ваши данные удалены. Вернуться можно командой /start.",
  help:
    "Я присылаю вопрос дня по промышленной безопасности, электробезопасности, охране труда и другим направлениям.\n\n" +
    "/settings — выбрать сферы и области\n/question — вопрос сейчас\n/stop — отключить рассылку\n\nТренажёр с полными банками вопросов: https://prombez-game.ru",
  noQuestion: "В выбранных областях пока нет подходящих вопросов. Выберите другие: /settings",
  nothingSelected: "Ничего не выбрано: вопросы приходить не будут. Выберите хотя бы одну область: /settings",
  saved: (selection) => `Готово. Вопросы будут из: ${selection}.\n\nИзменить выбор: /settings`,
  settingsButton: "⚙️ Выбрать сферы и области",
};

/** Разбор команды из текста сообщения: «/start site», «/stop@my_bot» → start, stop. */
export function parseCommand(text) {
  const m = /^\/([a-z_]+)(?:@\w+)?(?:\s|$)/i.exec((text ?? "").trim());
  const cmd = m?.[1]?.toLowerCase();
  return ["start", "stop", "question", "help", "settings"].includes(cmd) ? cmd : "text";
}

/** Параметр /start: «a_b1-1» с сайта — подписка на область b1-1. */
export function startArea(text) {
  const m = /^\/start(?:@\w+)?\s+a_([a-z0-9-]+)\s*$/i.exec((text ?? "").trim());
  return m ? m[1].toLowerCase() : null;
}
