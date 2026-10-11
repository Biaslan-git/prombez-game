/**
 * Импорт банка вопросов области.
 *   npx tsx scripts/import-questions.ts --area a1 --file data/raw/a1.json --version "2026-xx" [--publish] [--dry-run]
 *
 * Upsert по (area_id, number). Вопросы, которых нет в новой версии, деактивируются (не удаляются).
 * Slug существующего вопроса не меняется, даже если изменился текст.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { closeDb, getDb } from "../lib/db/client";
import { answers, areas, questions } from "../lib/db/schema";
import { parseImportFile } from "../lib/import";
import { questionSlug } from "../lib/slug";

const { values } = parseArgs({
  options: {
    area: { type: "string" },
    file: { type: "string" },
    version: { type: "string" },
    publish: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function main() {
  const slug = values.area?.trim().toLowerCase();
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) fail("Укажите --area, например --area a1 (латиница и цифры)");
  if (!values.file) fail("Укажите --file с JSON-банком вопросов");

  const parsed = parseImportFile(JSON.parse(await readFile(values.file, "utf8")));
  if (parsed.errors.length) {
    console.error(`Файл не прошёл проверку (${parsed.errors.length} ошибок):`);
    for (const e of parsed.errors) console.error("  - " + e);
    process.exit(1);
  }
  const { area: a, questions: incoming } = parsed;
  const bankVersion = values.version ?? a.bank_version ?? "";

  if (values["dry-run"]) {
    console.log(`Проверка пройдена: область ${a.code}, вопросов ${incoming.length}. В БД ничего не записано.`);
    return;
  }

  const db = getDb();
  const report = await db.transaction(async (tx) => {
    const areaValues = {
      code: a.code,
      title: a.title,
      bankVersion,
      ...(a.short_description !== undefined && { shortDescription: a.short_description }),
      ...(a.bank_updated_at !== undefined && { bankUpdatedAt: a.bank_updated_at }),
      ...(a.sort_order !== undefined && { sortOrder: a.sort_order }),
      ...(a.exam && {
        examQuestionsCount: a.exam.questions_count,
        examTimeLimitMin: a.exam.time_limit_min,
        examPassThreshold: a.exam.pass_threshold,
      }),
      ...(values.publish && { isPublished: true }),
    };
    const [areaRow] = await tx
      .insert(areas)
      .values({ slug, ...areaValues })
      .onConflictDoUpdate({ target: areas.slug, set: areaValues })
      .returning({ id: areas.id });
    const areaId = areaRow!.id;

    const existing = await tx.select().from(questions).where(eq(questions.areaId, areaId));
    const existingAnswers = existing.length
      ? await tx
          .select()
          .from(answers)
          .where(inArray(answers.questionId, existing.map((q) => q.id)))
          .orderBy(answers.questionId, answers.position)
      : [];
    const answersByQ = new Map<number, typeof existingAnswers>();
    for (const ans of existingAnswers) {
      const list = answersByQ.get(ans.questionId) ?? [];
      list.push(ans);
      answersByQ.set(ans.questionId, list);
    }
    const byNumber = new Map(existing.map((q) => [q.number, q]));
    const usedSlugs = new Set(existing.map((q) => q.slug));

    let added = 0;
    let updated = 0;
    let unchanged = 0;
    let reactivated = 0;

    for (const q of incoming) {
      const prev = byNumber.get(q.number);
      if (!prev) {
        let s = questionSlug(q.number, q.text);
        for (let i = 2; usedSlugs.has(s); i++) s = `${questionSlug(q.number, q.text)}-${i}`;
        usedSlugs.add(s);
        const [row] = await tx
          .insert(questions)
          .values({
            areaId,
            number: q.number,
            text: q.text,
            slug: s,
            normRef: q.normRef,
            explanation: q.explanation ?? null,
            explanationVerified: q.explanationVerified ?? false,
          })
          .returning({ id: questions.id });
        await tx.insert(answers).values(
          q.answers.map((ans, position) => ({ questionId: row!.id, text: ans.text, isCorrect: ans.isCorrect, position })),
        );
        added++;
        continue;
      }

      const prevAnswers = answersByQ.get(prev.id) ?? [];
      const answersChanged =
        prevAnswers.length !== q.answers.length ||
        prevAnswers.some((pa, i) => pa.text !== q.answers[i]!.text || pa.isCorrect !== q.answers[i]!.isCorrect);
      const explanationChanged =
        (q.explanation !== undefined && q.explanation !== prev.explanation) ||
        (q.explanationVerified !== undefined && q.explanationVerified !== prev.explanationVerified);
      const changed = prev.text !== q.text || prev.normRef !== q.normRef || answersChanged || explanationChanged;

      if (!prev.isActive) reactivated++;
      if (!changed && prev.isActive) {
        unchanged++;
        continue;
      }
      await tx
        .update(questions)
        .set({
          text: q.text,
          normRef: q.normRef,
          isActive: true,
          updatedAt: new Date(),
          ...(q.explanation !== undefined && { explanation: q.explanation }),
          // Изменился текст или ответы — старое объяснение требует повторной проверки.
          ...(q.explanationVerified !== undefined
            ? { explanationVerified: q.explanationVerified }
            : (prev.text !== q.text || answersChanged) && { explanationVerified: false }),
        })
        .where(eq(questions.id, prev.id));
      if (answersChanged) {
        await tx.delete(answers).where(eq(answers.questionId, prev.id));
        await tx.insert(answers).values(
          q.answers.map((ans, position) => ({ questionId: prev.id, text: ans.text, isCorrect: ans.isCorrect, position })),
        );
      }
      if (changed) updated++;
    }

    const incomingNumbers = incoming.map((q) => q.number);
    const deactivated = await tx
      .update(questions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(questions.areaId, areaId), eq(questions.isActive, true), notInArray(questions.number, incomingNumbers)))
      .returning({ id: questions.id });

    return { added, updated, unchanged, reactivated, deactivated: deactivated.length };
  });

  console.log(`Область ${a.code} (${slug}), версия банка «${bankVersion}»`);
  console.log(`  добавлено:       ${report.added}`);
  console.log(`  обновлено:       ${report.updated}`);
  console.log(`  без изменений:   ${report.unchanged}`);
  console.log(`  возвращено:      ${report.reactivated}`);
  console.log(`  деактивировано:  ${report.deactivated}`);

  await revalidate();
}

// Сброс ISR-кэша на работающем сайте, если заданы адрес и секрет.
async function revalidate() {
  const site = process.env.REVALIDATE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!site || !secret) return;
  try {
    const res = await fetch(new URL("/api/revalidate", site), {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    console.log(res.ok ? "Кэш страниц сброшен" : `Сброс кэша не удался: HTTP ${res.status}`);
  } catch (err) {
    console.log(`Сброс кэша не удался: ${(err as Error).message}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
