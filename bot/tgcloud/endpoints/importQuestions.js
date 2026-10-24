// Загрузка вопросов сайта в базу бота: `tgcloud run endpoints/importQuestions` из scripts/sync-bot.mjs.
// Порциями: { gen, questions: [...] }, в конце { gen, finish: true } — удалить вопросы прошлых синхронизаций.
import { db, EndpointError } from "sdk";
import { inArray, ne } from "sdk/db";
import { questions } from "../schema.js";

const CHUNK = 100;

export default async function importQuestions(input, ctx) {
  // Только из CLI (там init data не проверяется, и скрипт передаёт user.id = 0, которого у людей не бывает).
  if (ctx?.initData?.user?.id !== 0) throw new EndpointError("Только для синхронизации", { code: "FORBIDDEN" });
  const gen = input?.gen;
  if (!Number.isInteger(gen)) throw new EndpointError("Нужен gen", { code: "BAD_INPUT" });

  if (input.finish) {
    const removed = await db.delete(questions).where(ne(questions.gen, gen)).run();
    return { removed: removed.rowsAffected, total: await db.$count(questions) };
  }

  const list = Array.isArray(input.questions) ? input.questions : [];
  for (let i = 0; i < list.length; i += CHUNK) {
    const rows = list.slice(i, i + CHUNK).map((q) => ({
      id: q.id,
      areaSlug: q.areaSlug,
      data: { slug: q.slug, text: q.text, normRef: q.normRef ?? null, answers: q.answers },
      gen,
    }));
    await db
      .delete(questions)
      .where(
        inArray(
          questions.id,
          rows.map((r) => r.id),
        ),
      )
      .run();
    await db.insert(questions).values(rows).run();
  }
  return { saved: list.length };
}
