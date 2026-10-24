import { table, integer, text, boolean, json, index, sql } from "sdk/db";

// Подписчики бота «Вопрос дня». Хранится только идентификатор чата (и username, если он есть): /stop удаляет строку.
export const subscribers = table("subscribers", {
  chatId: integer("chat_id").primaryKey(),
  username: text("username"),
  active: boolean("active").notNull().default(true),
  // Номер дня (по Москве), за который вопрос уже отправлен: защита от дублей.
  lastSentDay: integer("last_sent_day"),
  // Позиция верного ответа в последней викторине: следующая будет на другой позиции.
  lastPos: integer("last_pos"),
  // Выбранные в /settings области (slug сайта); null — по умолчанию (lib/settings.js, DEFAULT_AREAS).
  areas: json("areas"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

// Вопросы для викторин — копия вопросов сайта, которые подходят для опроса Telegram. Заполняет
// scripts/sync-bot.mjs через endpoints/importQuestions; id — id вопроса на сайте.
export const questions = table(
  "questions",
  {
    id: integer("id").primaryKey(),
    areaSlug: text("area_slug").notNull(),
    // { slug, text, normRef, answers: [{ text, isCorrect }] }
    data: json("data").notNull(),
    // Номер синхронизации: после полной загрузки строки прошлых синхронизаций удаляются.
    gen: integer("gen").notNull(),
  },
  (t) => ({
    areaIdx: index("idx_questions_area").on(t.areaSlug, t.id),
  }),
);
