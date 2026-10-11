import { and, eq, inArray, notInArray } from "drizzle-orm";
import type { getDb } from "./db/client";
import { answers, areas, questions } from "./db/schema";
import type { ParsedImport } from "./import";
import { questionSlug } from "./slug";

export type ImportReport = {
  added: number;
  updated: number;
  unchanged: number;
  reactivated: number;
  deactivated: number;
};

export type ImportOptions = {
  /** Slug области в URL (a1, b93…). */
  slug: string;
  /** Версия банка, показывается на сайте. */
  version: string;
  /** Открыть область на сайте. Без флага новая область остаётся скрытой, а у существующей публикация не меняется. */
  publish: boolean;
};

/**
 * Запись проверенного банка вопросов в БД одной транзакцией.
 * Upsert по (area_id, number). Вопросы, которых нет в новой версии, деактивируются (не удаляются).
 * Slug существующего вопроса не меняется, даже если изменился текст.
 */
export async function runImport(
  db: ReturnType<typeof getDb>,
  parsed: Pick<ParsedImport, "area" | "questions">,
  opts: ImportOptions,
): Promise<ImportReport> {
  const { area: a, questions: incoming } = parsed;
  return db.transaction(async (tx) => {
    const areaValues = {
      code: a.code,
      title: a.title,
      bankVersion: opts.version,
      ...(a.short_description !== undefined && { shortDescription: a.short_description }),
      ...(a.bank_updated_at !== undefined && { bankUpdatedAt: a.bank_updated_at }),
      ...(a.sort_order !== undefined && { sortOrder: a.sort_order }),
      ...(a.exam && {
        examQuestionsCount: a.exam.questions_count,
        examTimeLimitMin: a.exam.time_limit_min,
        examPassThreshold: a.exam.pass_threshold,
      }),
      ...(opts.publish && { isPublished: true }),
    };
    const [areaRow] = await tx
      .insert(areas)
      .values({ slug: opts.slug, ...areaValues })
      .onConflictDoUpdate({ target: areas.slug, set: areaValues })
      .returning({ id: areas.id });
    const areaId = areaRow!.id;

    const existing = await tx.select().from(questions).where(eq(questions.areaId, areaId));
    const existingAnswers = existing.length
      ? await tx
          .select()
          .from(answers)
          .where(
            inArray(
              answers.questionId,
              existing.map((q) => q.id),
            ),
          )
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
          q.answers.map((ans, position) => ({
            questionId: row!.id,
            text: ans.text,
            isCorrect: ans.isCorrect,
            position,
          })),
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
          q.answers.map((ans, position) => ({
            questionId: prev.id,
            text: ans.text,
            isCorrect: ans.isCorrect,
            position,
          })),
        );
      }
      if (changed) updated++;
    }

    const incomingNumbers = incoming.map((q) => q.number);
    const deactivated = await tx
      .update(questions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(eq(questions.areaId, areaId), eq(questions.isActive, true), notInArray(questions.number, incomingNumbers)),
      )
      .returning({ id: questions.id });

    return { added, updated, unchanged, reactivated, deactivated: deactivated.length };
  });
}
