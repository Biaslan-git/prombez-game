// Выбор вопроса из вопросов, загруженных в базу бота (таблица questions), по областям подписчика.
import { db } from "sdk";
import { asc, inArray } from "sdk/db";
import { questions } from "../schema.js";
import { dailyIndex, dayNumber, randomIndex } from "./daily.js";

async function questionAt(areas, k) {
  const row = await db
    .select()
    .from(questions)
    .where(inArray(questions.areaSlug, areas))
    .orderBy(asc(questions.id))
    .limit(1)
    .offset(k)
    .get();
  return row ? { ...row.data, id: row.id, areaSlug: row.areaSlug } : null;
}

/** Вопрос для подписчика: вопрос дня или (random) случайный, но не вопрос дня. null — в выбранных областях пусто. */
export async function pickQuestion(areas, chatId, now, random = false) {
  if (!areas.length) return null;
  const n = await db.$count(questions, inArray(questions.areaSlug, areas));
  const daily = dailyIndex(n, dayNumber(now), chatId);
  const k = random ? randomIndex(n, daily) : daily;
  return k < 0 ? null : questionAt(areas, k);
}
