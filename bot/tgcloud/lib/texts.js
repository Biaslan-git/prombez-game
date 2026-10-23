export const TEXTS = {
  welcome:
    "Привет! Каждый день в 9:00 по Москве я буду присылать один вопрос из банка Ростехнадзора по промышленной безопасности: выберите ответ и сразу узнаете результат.\n\n/question — вопрос прямо сейчас\n/stop — отключить рассылку\n\nВот вопрос на сегодня 👇",
  stopped: "Рассылка отключена, ваши данные удалены. Вернуться можно командой /start.",
  help: "Я присылаю вопрос дня по промышленной безопасности.\n\n/question — вопрос сейчас\n/stop — отключить рассылку\n\nТренажёр с полными банками вопросов: https://prombez-game.ru",
  noQuestion: "Пока не получается подобрать вопрос, попробуйте позже.",
};

/** Разбор команды из текста сообщения: «/start site», «/stop@my_bot» → start, stop. */
export function parseCommand(text) {
  const m = /^\/([a-z_]+)(?:@\w+)?(?:\s|$)/i.exec((text ?? "").trim());
  const cmd = m?.[1]?.toLowerCase();
  return ["start", "stop", "question", "help"].includes(cmd) ? cmd : "text";
}
