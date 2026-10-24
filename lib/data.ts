import { and, asc, count, desc, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "./db/client";
import { answers, areas, questionImages, questions, type Area } from "./db/schema";
import { HL_END, HL_START } from "./highlight";
import { pickCanonicals, type CanonicalTarget } from "./canonical";
import { getTopic, summarizeTopics, type TopicSummary } from "./topics";
import { courseOrder } from "./courses";
import type { QuestionKind } from "./question-kind";

export type AreaSummary = Area & { questionCount: number };

/** position — место в банке; в вопросах на порядок и соответствие это правильный порядок. */
export type ClientAnswer = { id: number; text: string; isCorrect: boolean; position: number };
/** Вопрос для тренировки и экзамена (передаётся в клиентские компоненты). */
export type ClientQuestion = {
  id: number;
  number: number;
  slug: string;
  text: string;
  answers: ClientAnswer[];
  multi: boolean;
  kind: QuestionKind;
  /** Адрес картинки к вопросу или null. */
  image: string | null;
  explanation: string | null; // только проверенные объяснения
  normRef: string | null;
};

/** Адрес картинки вопроса; хэш в query сбрасывает кэш браузера, когда картинка меняется. */
export function questionImageUrl(questionId: number, hash: string | null): string | null {
  return hash ? `/qimg/${questionId}?v=${hash.slice(0, 10)}` : null;
}

export const getPublishedAreas = cache(async (): Promise<AreaSummary[]> => {
  const db = getDb();
  const rows = await db
    .select({ area: areas, questionCount: count(questions.id) })
    .from(areas)
    .leftJoin(questions, and(eq(questions.areaId, areas.id), eq(questions.isActive, true)))
    .where(eq(areas.isPublished, true))
    .groupBy(areas.id)
    .orderBy(asc(areas.sortOrder), asc(areas.code));
  return rows
    .map((r) => ({ ...r.area, questionCount: r.questionCount }))
    .sort((a, b) => courseOrder(a.courseSlug) - courseOrder(b.courseSlug));
});

/** Опубликованные области сферы. */
export async function getCourseAreas(courseSlug: string): Promise<AreaSummary[]> {
  return (await getPublishedAreas()).filter((a) => (a.courseSlug || "prombez") === courseSlug);
}

/** Картинка вопроса опубликованной области. */
export async function getQuestionImage(questionId: number) {
  const [row] = await getDb()
    .select({ mime: questionImages.mime, data: questionImages.data })
    .from(questionImages)
    .innerJoin(questions, eq(questions.id, questionImages.questionId))
    .innerJoin(areas, eq(areas.id, questions.areaId))
    .where(and(eq(questionImages.questionId, questionId), eq(areas.isPublished, true)))
    .limit(1);
  return row ?? null;
}

export const getArea = cache(async (slug: string): Promise<AreaSummary | null> => {
  const all = await getPublishedAreas();
  return all.find((a) => a.slug === slug) ?? null;
});

const areaQuestionsMemo = new Map<number, { at: number; value: Promise<ClientQuestion[]> }>();

/**
 * Все активные вопросы области с ответами — для тренировки, экзамена и мини-теста.
 * Результат держим минуту в памяти: при сборке и ISR им пользуются тысячи страниц вопросов.
 */
export function getAreaQuestions(areaId: number): Promise<ClientQuestion[]> {
  const hit = areaQuestionsMemo.get(areaId);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const value = loadAreaQuestions(areaId);
  areaQuestionsMemo.set(areaId, { at: Date.now(), value });
  value.catch(() => {
    if (areaQuestionsMemo.get(areaId)?.value === value) areaQuestionsMemo.delete(areaId);
  });
  return value;
}

async function loadAreaQuestions(areaId: number): Promise<ClientQuestion[]> {
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
      kind: questions.kind,
      imageHash: questions.imageHash,
    })
    .from(questions)
    .where(and(eq(questions.areaId, areaId), eq(questions.isActive, true)))
    .orderBy(asc(questions.number));
  const ans = await db
    .select({
      id: answers.id,
      questionId: answers.questionId,
      text: answers.text,
      isCorrect: answers.isCorrect,
      position: answers.position,
    })
    .from(answers)
    .innerJoin(questions, eq(questions.id, answers.questionId))
    .where(and(eq(questions.areaId, areaId), eq(questions.isActive, true)))
    .orderBy(asc(answers.questionId), asc(answers.position));
  const byQ = new Map<number, ClientAnswer[]>();
  for (const a of ans) {
    const list = byQ.get(a.questionId) ?? [];
    list.push({ id: a.id, text: a.text, isCorrect: a.isCorrect, position: a.position });
    byQ.set(a.questionId, list);
  }
  return qs.map((q) => {
    const list = byQ.get(q.id) ?? [];
    const kind = q.kind as QuestionKind;
    return {
      id: q.id,
      number: q.number,
      slug: q.slug,
      text: q.text,
      answers: list,
      multi: kind === "choice" && list.filter((a) => a.isCorrect).length > 1,
      kind,
      image: questionImageUrl(q.id, q.imageHash),
      explanation: q.explanationVerified ? q.explanation : null,
      normRef: q.normRef,
    };
  });
}

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
  kind: QuestionKind;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  answers: ClientAnswer[];
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
      .select({ id: answers.id, text: answers.text, isCorrect: answers.isCorrect, position: answers.position })
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
    kind: q.kind as QuestionKind,
    image: questionImageUrl(q.id, q.imageHash),
    createdAt: q.createdAt,
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

let dupMemo: { at: number; value: Promise<Map<number, CanonicalTarget>> } | null = null;

/**
 * id неглавных копий вопроса → адрес главной страницы. Считается по всем опубликованным вопросам, поэтому
 * результат держим в памяти 10 минут: при сборке и ISR им пользуются тысячи страниц.
 */
export function getDuplicateTargets(): Promise<Map<number, CanonicalTarget>> {
  if (dupMemo && Date.now() - dupMemo.at < 10 * 60_000) return dupMemo.value;
  const value = (async () => {
    const db = getDb();
    const published = and(eq(areas.isPublished, true), eq(questions.isActive, true));
    const [rows, correct] = await Promise.all([
      db
        .select({
          id: questions.id,
          number: questions.number,
          slug: questions.slug,
          text: questions.text,
          imageHash: questions.imageHash,
          areaSlug: areas.slug,
          areaCode: areas.code,
        })
        .from(questions)
        .innerJoin(areas, eq(areas.id, questions.areaId))
        .where(published),
      db
        .select({ questionId: answers.questionId, text: answers.text })
        .from(answers)
        .innerJoin(questions, eq(questions.id, answers.questionId))
        .innerJoin(areas, eq(areas.id, questions.areaId))
        .where(and(published, eq(answers.isCorrect, true))),
    ]);
    const byQ = new Map<number, string[]>();
    for (const c of correct) {
      const list = byQ.get(c.questionId);
      if (list) list.push(c.text);
      else byQ.set(c.questionId, [c.text]);
    }
    return pickCanonicals(rows.map((r) => ({ ...r, correct: byQ.get(r.id) ?? [] })));
  })();
  dupMemo = { at: Date.now(), value };
  value.catch(() => {
    if (dupMemo?.value === value) dupMemo = null;
  });
  return value;
}

/** Страницы вопросов для sitemap: без неглавных копий. */
export async function getSitemapEntries() {
  const [rows, dups] = await Promise.all([
    getDb()
      .select({ id: questions.id, areaSlug: areas.slug, slug: questions.slug, updatedAt: questions.updatedAt })
      .from(questions)
      .innerJoin(areas, eq(areas.id, questions.areaId))
      .where(eq(areas.isPublished, true))
      .orderBy(asc(areas.sortOrder), asc(questions.number)),
    getDuplicateTargets(),
  ]);
  return rows.filter((r) => !dups.has(r.id));
}

/** Канонические вопросы области для «вопроса дня» в Telegram (дубли других областей не берём). */
/**
 * Вопросы области для бота «Вопрос дня»: только выбор ответа и без картинок (в опросе Telegram её не показать).
 * Копии вопросов из других областей не отбрасываем: подписчик выбирает области сам, и у каждой должен быть полный набор.
 */
export async function getPollCandidates(areaSlug: string) {
  const area = await getArea(areaSlug);
  if (!area) return [];
  const list = await getAreaQuestions(area.id);
  return list
    .filter((q) => q.kind === "choice" && !q.image)
    .map((q) => ({
      id: q.id,
      areaSlug: area.slug,
      slug: q.slug,
      text: q.text,
      normRef: q.normRef,
      answers: q.answers.map((a) => ({ text: a.text, isCorrect: a.isCorrect })),
    }));
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
