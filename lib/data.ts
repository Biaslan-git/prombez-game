import { and, asc, count, desc, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "./db/client";
import { answers, areas, questions, type Area } from "./db/schema";
import { HL_END, HL_START } from "./highlight";
import { getTopic, summarizeTopics, type TopicSummary } from "./topics";

export type AreaSummary = Area & { questionCount: number };

export type ClientAnswer = { id: number; text: string; isCorrect: boolean };
/** Вопрос для тренировки и экзамена (передаётся в клиентские компоненты). */
export type ClientQuestion = {
  id: number;
  number: number;
  slug: string;
  text: string;
  answers: ClientAnswer[];
  multi: boolean;
  explanation: string | null; // только проверенные объяснения
  normRef: string | null;
};

export const getPublishedAreas = cache(async (): Promise<AreaSummary[]> => {
  const db = getDb();
  const rows = await db
    .select({ area: areas, questionCount: count(questions.id) })
    .from(areas)
    .leftJoin(questions, and(eq(questions.areaId, areas.id), eq(questions.isActive, true)))
    .where(eq(areas.isPublished, true))
    .groupBy(areas.id)
    .orderBy(asc(areas.sortOrder), asc(areas.code));
  return rows.map((r) => ({ ...r.area, questionCount: r.questionCount }));
});

export const getArea = cache(async (slug: string): Promise<AreaSummary | null> => {
  const all = await getPublishedAreas();
  return all.find((a) => a.slug === slug) ?? null;
});

/** Все активные вопросы области с ответами — для тренировки и экзамена. */
export const getAreaQuestions = cache(async (areaId: number): Promise<ClientQuestion[]> => {
  const db = getDb();
  const qs = await db
    .select({
      id: questions.id,
      number: questions.number,
      slug: questions.slug,
      text: questions.text,
      explanation: questions.explanation,
      explanationVerified: questions.explanationVerified,
      normRef: questions.normRef,
    })
    .from(questions)
    .where(and(eq(questions.areaId, areaId), eq(questions.isActive, true)))
    .orderBy(asc(questions.number));
  const ans = await db
    .select({ id: answers.id, questionId: answers.questionId, text: answers.text, isCorrect: answers.isCorrect })
    .from(answers)
    .innerJoin(questions, eq(questions.id, answers.questionId))
    .where(and(eq(questions.areaId, areaId), eq(questions.isActive, true)))
    .orderBy(asc(answers.questionId), asc(answers.position));
  const byQ = new Map<number, ClientAnswer[]>();
  for (const a of ans) {
    const list = byQ.get(a.questionId) ?? [];
    list.push({ id: a.id, text: a.text, isCorrect: a.isCorrect });
    byQ.set(a.questionId, list);
  }
  return qs.map((q) => {
    const list = byQ.get(q.id) ?? [];
    return {
      id: q.id,
      number: q.number,
      slug: q.slug,
      text: q.text,
      answers: list,
      multi: list.filter((a) => a.isCorrect).length > 1,
      explanation: q.explanationVerified ? q.explanation : null,
      normRef: q.normRef,
    };
  });
});

export type QuestionListItem = { id: number; number: number; slug: string; text: string; isActive: boolean };

export const getAreaQuestionList = cache(async (areaId: number): Promise<QuestionListItem[]> => {
  return getDb()
    .select({
      id: questions.id,
      number: questions.number,
      slug: questions.slug,
      text: questions.text,
      isActive: questions.isActive,
    })
    .from(questions)
    .where(eq(questions.areaId, areaId))
    .orderBy(asc(questions.number));
});

/** Темы области, в которых достаточно вопросов для отдельной страницы. */
export const getAreaTopics = cache(async (areaId: number): Promise<TopicSummary[]> => {
  const list = await getAreaQuestionList(areaId);
  return summarizeTopics(list.filter((q) => q.isActive));
});

/** Вопросы темы с ответами или null, если темы нет или в ней слишком мало вопросов. */
export async function getTopicQuestions(areaId: number, topicSlug: string) {
  const topic = getTopic(topicSlug);
  if (!topic || !(await getAreaTopics(areaId)).some((t) => t.slug === topicSlug)) return null;
  const all = await getAreaQuestions(areaId);
  return { topic, questions: all.filter((q) => topic.pattern.test(q.text)) };
}

export type QuestionPageData = {
  id: number;
  number: number;
  slug: string;
  text: string;
  isActive: boolean;
  explanation: string | null;
  normRef: string | null;
  updatedAt: Date;
  answers: { id: number; text: string; isCorrect: boolean }[];
  prev: { slug: string; number: number } | null;
  next: { slug: string; number: number } | null;
};

export const getQuestionPage = cache(async (areaId: number, slug: string): Promise<QuestionPageData | null> => {
  const db = getDb();
  const [q] = await db
    .select()
    .from(questions)
    .where(and(eq(questions.areaId, areaId), eq(questions.slug, slug)))
    .limit(1);
  if (!q) return null;
  const [ans, [prev], [next]] = await Promise.all([
    db
      .select({ id: answers.id, text: answers.text, isCorrect: answers.isCorrect })
      .from(answers)
      .where(eq(answers.questionId, q.id))
      .orderBy(asc(answers.position)),
    db
      .select({ slug: questions.slug, number: questions.number })
      .from(questions)
      .where(and(eq(questions.areaId, areaId), eq(questions.isActive, true), lt(questions.number, q.number)))
      .orderBy(desc(questions.number))
      .limit(1),
    db
      .select({ slug: questions.slug, number: questions.number })
      .from(questions)
      .where(and(eq(questions.areaId, areaId), eq(questions.isActive, true), gt(questions.number, q.number)))
      .orderBy(asc(questions.number))
      .limit(1),
  ]);
  return {
    id: q.id,
    number: q.number,
    slug: q.slug,
    text: q.text,
    isActive: q.isActive,
    explanation: q.explanationVerified ? q.explanation : null,
    normRef: q.normRef,
    updatedAt: q.updatedAt,
    answers: ans,
    prev: prev ?? null,
    next: next ?? null,
  };
});

/** Похожие вопросы той же области: FTS по словам текста вопроса, объединённым через OR. */
export async function getSimilarQuestions(areaId: number, questionId: number, text: string, limit = 5) {
  const query = sql`replace(plainto_tsquery('russian', ${text.slice(0, 500)})::text, '&', '|')::tsquery`;
  return getDb()
    .select({ slug: questions.slug, number: questions.number, text: questions.text })
    .from(questions)
    .where(
      and(
        eq(questions.areaId, areaId),
        eq(questions.isActive, true),
        ne(questions.id, questionId),
        sql`${questions.searchVector} @@ ${query}`,
      ),
    )
    .orderBy(sql`ts_rank(${questions.searchVector}, ${query}) desc`, asc(questions.number))
    .limit(limit);
}

export type SearchResult = {
  areaCode: string;
  areaSlug: string;
  number: number;
  slug: string;
  headline: string; // фрагменты совпадений помечены ⟦…⟧
  correct: string[];
};

/** Полнотекстовый поиск; если FTS ничего не нашёл (кусок слова), ищем подстроку. */
export async function searchQuestions(q: string, limit = 30): Promise<SearchResult[]> {
  const term = q.trim().slice(0, 200);
  if (term.length < 2) return [];
  const db = getDb();
  const tsq = sql`websearch_to_tsquery('russian', ${term})`;
  const headline = sql<string>`ts_headline('russian', ${questions.text}, ${tsq}, ${`StartSel=${HL_START}, StopSel=${HL_END}, MaxWords=40, MinWords=20, MaxFragments=2, FragmentDelimiter=" … "`})`;
  const base = {
    areaCode: areas.code,
    areaSlug: areas.slug,
    number: questions.number,
    slug: questions.slug,
    questionId: questions.id,
  };
  const published = and(eq(areas.isPublished, true), eq(questions.isActive, true));

  let rows = await db
    .select({ ...base, headline })
    .from(questions)
    .innerJoin(areas, eq(areas.id, questions.areaId))
    .where(and(published, sql`${questions.searchVector} @@ ${tsq}`))
    .orderBy(sql`ts_rank_cd(${questions.searchVector}, ${tsq}) desc`, asc(areas.sortOrder), asc(questions.number))
    .limit(limit);

  if (rows.length === 0) {
    const pattern = `%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    const found = await db
      .select({ ...base, text: questions.text })
      .from(questions)
      .innerJoin(areas, eq(areas.id, questions.areaId))
      .where(and(published, sql`${questions.text} ilike ${pattern}`))
      .orderBy(asc(areas.sortOrder), asc(questions.number))
      .limit(limit);
    rows = found.map((r) => ({ ...r, headline: highlightSubstring(r.text, term) }));
  }
  if (rows.length === 0) return [];

  const correct = await db
    .select({ questionId: answers.questionId, text: answers.text })
    .from(answers)
    .where(
      and(
        inArray(
          answers.questionId,
          rows.map((r) => r.questionId),
        ),
        eq(answers.isCorrect, true),
      ),
    )
    .orderBy(asc(answers.position));
  return rows.map((r) => ({
    areaCode: r.areaCode,
    areaSlug: r.areaSlug,
    number: r.number,
    slug: r.slug,
    headline: r.headline,
    correct: correct.filter((c) => c.questionId === r.questionId).map((c) => c.text),
  }));
}

function highlightSubstring(text: string, term: string): string {
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return text;
  return text.slice(0, i) + HL_START + text.slice(i, i + term.length) + HL_END + text.slice(i + term.length);
}

export async function getSitemapEntries() {
  return getDb()
    .select({ areaSlug: areas.slug, slug: questions.slug, updatedAt: questions.updatedAt })
    .from(questions)
    .innerJoin(areas, eq(areas.id, questions.areaId))
    .where(eq(areas.isPublished, true))
    .orderBy(asc(areas.sortOrder), asc(questions.number));
}

/** Параметры для generateStaticParams: при сборке без БД возвращаем пустой список (страницы соберутся по ISR). */
export async function safeStaticParams<T>(fn: () => Promise<T[]>): Promise<T[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    return await fn();
  } catch {
    return [];
  }
}
