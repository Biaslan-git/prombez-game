// Подписчик и его выбор областей в базе бота.
import { db } from "sdk";
import { eq } from "sdk/db";
import { subscribers } from "../schema.js";
import { selectedAreas } from "./settings.js";

export const getSubscriber = (chatId) => db.select().from(subscribers).where(eq(subscribers.chatId, chatId)).get();

/** Сохранить выбор областей. Если строки ещё нет (настройки до /start), она создаётся без подписки. */
export async function saveAreas(chatId, areas) {
  await db
    .insert(subscribers)
    .values({ chatId, active: false, areas })
    .onConflictDoUpdate({ target: subscribers.chatId, set: { areas } })
    .run();
}

export const areasOf = (sub) => selectedAreas(sub?.areas);
