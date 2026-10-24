import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const areas = pgTable("areas", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  shortDescription: text("short_description").notNull().default(""),
  // Параметры экзамена хранятся в БД: регламент ЕПТ может меняться.
  examQuestionsCount: integer("exam_questions_count").notNull().default(20),
  examTimeLimitMin: integer("exam_time_limit_min").notNull().default(20),
  examPassThreshold: integer("exam_pass_threshold").notNull().default(18),
  bankVersion: text("bank_version").notNull().default(""),
  bankUpdatedAt: date("bank_updated_at", { mode: "string" }),
  isPublished: boolean("is_published").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  // Сфера (lib/courses.ts) и раздел внутри неё: по ним области группируются на главной и на странице сферы.
  courseSlug: text("course_slug").notNull().default(""),
  sectionTitle: text("section_title"),
  // Чей это банк вопросов («Ростехнадзора», «Минтруда»); null — учебный тест без официального банка.
  authority: text("authority"),
});

export const questions = pgTable(
  "questions",
  {
    id: serial("id").primaryKey(),
    areaId: integer("area_id")
      .notNull()
      .references(() => areas.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    text: text("text").notNull(),
    slug: text("slug").notNull(),
    explanation: text("explanation"),
    normRef: text("norm_ref"),
    explanationVerified: boolean("explanation_verified").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    // choice — выбор вариантов; order — расставить по порядку; match — сопоставить «левое --- правое».
    kind: text("kind").notNull().default("choice"),
    // id вопроса в источнике банка: по нему сопоставляются версии при повторном импорте.
    sourceId: integer("source_id"),
    // sha1 картинки к вопросу (сама картинка — в question_images); null — картинки нет.
    imageHash: text("image_hash"),
    searchVector: tsvector("search_vector").generatedAlwaysAs(sql`to_tsvector('russian', "text")`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("questions_area_number_uq").on(t.areaId, t.number),
    uniqueIndex("questions_area_slug_uq").on(t.areaId, t.slug),
    index("questions_search_idx").using("gin", t.searchVector),
    index("questions_area_source_idx").on(t.areaId, t.sourceId),
  ],
);

export const answers = pgTable(
  "answers",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [index("answers_question_idx").on(t.questionId, t.position)],
);

/** Картинка к вопросу: часто сам вопрос и есть картинка (бланк, знаки), а ответы — «Рисунок 1», «Рисунок 2». */
export const questionImages = pgTable("question_images", {
  questionId: integer("question_id")
    .primaryKey()
    .references(() => questions.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  data: text("data").notNull(), // base64
});

export type Area = typeof areas.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Answer = typeof answers.$inferSelect;
