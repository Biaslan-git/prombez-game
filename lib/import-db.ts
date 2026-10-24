import { eq, inArray } from "drizzle-orm";
import { TransactionRollbackError } from "drizzle-orm/errors";
import type { getDb } from "./db/client";
import { answers, areas, questionImages, questions } from "./db/schema";
import type { ImportQuestion, ParsedImport } from "./import";
import { matchKey, planNumbers } from "./import-match";
import { questionSlug } from "./slug";

export type ImportReport = {
  added: number;
  updated: number;
  unchanged: number;
  reactivated: number;
  deactivated: number;
  /** Сколько вопросов узнано по id источника и сколько — по тексту (у старых версий банка id источника нет). */
  matchedBySource: number;
  matchedByText: number;
};

export type ImportOptions = {
  /** Slug области в URL (a1, b93…). */
  slug: string;
  /** Версия банка, показывается на сайте. */
  version: string;
  /** Открыть область на сайте. Без флага новая область остаётся скрытой, а у существующей публикация не меняется. */
  publish: boolean;
  /** Посчитать отчёт и откатить транзакцию: ничего не записывается. */
  dryRun?: boolean;
};

/**
 * Запись проверенного банка вопросов в БД одной транзакцией.
 * Если у всех вопросов файла есть source_id, вопрос узнаётся по нему, а если в БД его ещё нет — по тексту
 * (так старые страницы и прогресс переходят к той же формулировке из нового источника); новым вопросам
 * достаются свободные номера. Без source_id — upsert по (area_id, number), как раньше.
 * Вопросы, которых нет в новой версии, деактивируются (не удаляются). Slug существующего вопроса не меняется.
 */
export async function runImport(
  db: ReturnType<typeof getDb>,
  parsed: Pick<ParsedImport, "area" | "questions">,
  opts: ImportOptions,
): Promise<ImportReport> {
  let report: ImportReport | undefined;
  try {
    await db.transaction(async (tx) => {
      report = await importInTx(tx, parsed, opts);
      if (opts.dryRun) tx.rollback();
    });
  } catch (err) {
    if (!(opts.dryRun && err instanceof TransactionRollbackError)) throw err;
  }
  return report!;
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function importInTx(
  tx: Tx,
  parsed: Pick<ParsedImport, "area" | "questions">,
  opts: ImportOptions,
): Promise<ImportReport> {
  const { area: a, questions: incoming } = parsed;
  const areaValues = {
    code: a.code,
    title: a.title,
    bankVersion: opts.version,
    ...(a.short_description !== undefined && { shortDescription: a.short_description }),
    ...(a.bank_updated_at !== undefined && { bankUpdatedAt: a.bank_updated_at }),
    ...(a.sort_order !== undefined && { sortOrder: a.sort_order }),
    ...(a.course !== undefined && { courseSlug: a.course }),
    ...(a.section !== undefined && { sectionTitle: a.section }),
    ...(a.authority !== undefined && { authority: a.authority }),
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

  const plan = planNumbers(
    existing.map((q) => ({
      id: q.id,
      number: q.number,
      sourceId: q.sourceId,
      key: matchKey(q.text, q.imageHash),
    })),
    incoming.map((q) => ({ number: q.number, sourceId: q.sourceId, key: matchKey(q.text, q.image?.hash ?? null) })),
  );
  const byId = new Map(existing.map((q) => [q.id, q]));
  const usedSlugs = new Set(existing.map((q) => q.slug));

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let reactivated = 0;

  for (const [i, q] of incoming.entries()) {
    const { number, prevId } = plan.items[i]!;
    const prev = prevId === null ? undefined : byId.get(prevId);
    if (!prev) {
      let s = questionSlug(number, q.text);
      for (let n = 2; usedSlugs.has(s); n++) s = `${questionSlug(number, q.text)}-${n}`;
      usedSlugs.add(s);
      const [row] = await tx
        .insert(questions)
        .values({
          areaId,
          number,
          text: q.text,
          slug: s,
          normRef: q.normRef,
          explanation: q.explanation ?? null,
          explanationVerified: q.explanationVerified ?? false,
          kind: q.kind,
          sourceId: q.sourceId,
          imageHash: q.image?.hash ?? null,
        })
        .returning({ id: questions.id });
      await insertAnswers(tx, row!.id, q);
      if (q.image)
        await tx.insert(questionImages).values({ questionId: row!.id, mime: q.image.mime, data: q.image.data });
      added++;
      continue;
    }

    const prevAnswers = answersByQ.get(prev.id) ?? [];
    const answersChanged =
      prevAnswers.length !== q.answers.length ||
      prevAnswers.some((pa, n) => pa.text !== q.answers[n]!.text || pa.isCorrect !== q.answers[n]!.isCorrect);
    const explanationChanged =
      (q.explanation !== undefined && q.explanation !== prev.explanation) ||
      (q.explanationVerified !== undefined && q.explanationVerified !== prev.explanationVerified);
    const imageHash = q.image?.hash ?? null;
    const imageChanged = imageHash !== prev.imageHash;
    const changed =
      prev.text !== q.text ||
      prev.normRef !== q.normRef ||
      prev.kind !== q.kind ||
      (q.sourceId !== null && prev.sourceId !== q.sourceId) ||
      answersChanged ||
      explanationChanged ||
      imageChanged;

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
        kind: q.kind,
        imageHash,
        isActive: true,
        updatedAt: new Date(),
        ...(q.sourceId !== null && { sourceId: q.sourceId }),
        ...(q.explanation !== undefined && { explanation: q.explanation }),
        // Изменился текст или ответы — старое объяснение требует повторной проверки.
        ...(q.explanationVerified !== undefined
          ? { explanationVerified: q.explanationVerified }
          : (prev.text !== q.text || answersChanged) && { explanationVerified: false }),
      })
      .where(eq(questions.id, prev.id));
    if (answersChanged) {
      await tx.delete(answers).where(eq(answers.questionId, prev.id));
      await insertAnswers(tx, prev.id, q);
    }
    if (imageChanged) {
      if (q.image) {
        await tx
          .insert(questionImages)
          .values({ questionId: prev.id, mime: q.image.mime, data: q.image.data })
          .onConflictDoUpdate({ target: questionImages.questionId, set: { mime: q.image.mime, data: q.image.data } });
      } else {
        await tx.delete(questionImages).where(eq(questionImages.questionId, prev.id));
      }
    }
    if (changed) updated++;
  }

  const toDeactivate = existing.filter((q) => q.isActive && !plan.claimed.has(q.id)).map((q) => q.id);
  if (toDeactivate.length) {
    await tx
      .update(questions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(inArray(questions.id, toDeactivate));
  }

  return {
    added,
    updated,
    unchanged,
    reactivated,
    deactivated: toDeactivate.length,
    matchedBySource: plan.matchedBySource,
    matchedByText: plan.matchedByText,
  };
}

async function insertAnswers(tx: Tx, questionId: number, q: ImportQuestion) {
  await tx.insert(answers).values(
    q.answers.map((ans, position) => ({
      questionId,
      text: ans.text,
      isCorrect: ans.isCorrect,
      position,
    })),
  );
}
