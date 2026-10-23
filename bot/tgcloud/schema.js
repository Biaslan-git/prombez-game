import { table, integer, text, boolean, sql } from "sdk/db";

// Подписчики бота «Вопрос дня». Хранится только идентификатор чата (и username, если он есть): /stop удаляет строку.
export const subscribers = table("subscribers", {
  chatId: integer("chat_id").primaryKey(),
  username: text("username"),
  active: boolean("active").notNull().default(true),
  // Номер дня (по Москве), за который вопрос уже отправлен: защита от дублей.
  lastSentDay: integer("last_sent_day"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});
