import { createHash } from "node:crypto";
import { z } from "zod";
import { QUESTION_KINDS, joinPair, splitPair, type QuestionKind } from "./question-kind";
import { normalizeText } from "./text";

const IMAGE_RE = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=\s]+)$/;

const answerSchema = z.object({
  text: z.string().trim().min(1, "пустой текст ответа"),
  is_correct: z.boolean(),
});

const questionSchema = z
  .object({
    number: z.number().int().positive(),
    text: z.string().trim().min(1, "пустой текст вопроса"),
    answers: z.array(answerSchema).min(2, "нужно не меньше двух вариантов ответа"),
    norm_ref: z.string().trim().min(1).nullish(),
    explanation: z.string().trim().min(1).nullish(),
    explanation_verified: z.boolean().optional(),
    kind: z.enum(QUESTION_KINDS).optional(),
    source_id: z.number().int().positive().nullish(),
    image: z.string().regex(IMAGE_RE, "картинка — data URI PNG, JPEG, GIF или WebP").nullish(),
  })
  .refine((q) => q.answers.some((a) => a.is_correct), {
    message: "нет ни одного правильного ответа",
    path: ["answers"],
  })
  .refine((q) => !q.kind || q.kind === "choice" || q.answers.every((a) => a.is_correct), {
    message: "в вопросе на порядок или соответствие все варианты должны быть отмечены верными",
    path: ["answers"],
  })
  .refine((q) => q.kind !== "match" || q.answers.every((a) => splitPair(a.text)), {
    message: "в вопросе на соответствие каждый вариант — «левое --- правое»",
    path: ["answers"],
  });

export const importFileSchema = z.object({
  area: z.object({
    code: z.string().trim().min(1),
    title: z.string().trim().min(1),
    short_description: z.string().trim().optional(),
    bank_version: z.string().trim().optional(),
    bank_updated_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "формат YYYY-MM-DD")
      .optional(),
    // Параметры экзамена — сверить с актуальным регламентом ЕПТ.
    exam: z
      .object({
        questions_count: z.number().int().positive(),
        time_limit_min: z.number().int().positive(),
        pass_threshold: z.number().int().positive(),
      })
      .optional(),
    sort_order: z.number().int().optional(),
    // Сфера (slug из lib/courses.ts), раздел внутри неё и чей это банк («Ростехнадзора»; null — учебный тест).
    course: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+$/, "slug сферы: латиница, цифры и дефис")
      .optional(),
    section: z.string().trim().min(1).nullish(),
    authority: z.string().trim().min(1).nullish(),
  }),
  questions: z.array(z.unknown()).min(1, "в файле нет вопросов"),
});

export type ImportQuestion = {
  number: number;
  text: string;
  answers: { text: string; isCorrect: boolean }[];
  normRef: string | null;
  explanation: string | null | undefined;
  explanationVerified: boolean | undefined;
  kind: QuestionKind;
  sourceId: number | null;
  image: { mime: string; data: string; hash: string } | null;
};

export type ParsedImport = {
  area: z.infer<typeof importFileSchema>["area"];
  questions: ImportQuestion[];
  errors: string[];
};

/** Разбор и валидация входного JSON. Ошибки собираются целиком, с номером вопроса. */
export function parseImportFile(raw: unknown): ParsedImport {
  const top = importFileSchema.safeParse(raw);
  if (!top.success) {
    return {
      area: { code: "", title: "" },
      questions: [],
      errors: top.error.issues.map((i) => `${i.path.join(".") || "файл"}: ${i.message}`),
    };
  }

  const errors: string[] = [];
  const questions: ImportQuestion[] = [];
  const seen = new Set<number>();
  const seenSource = new Set<number>();
  top.data.questions.forEach((rawQ, index) => {
    const res = questionSchema.safeParse(rawQ);
    const num = (rawQ as { number?: unknown } | null)?.number;
    const label = typeof num === "number" ? `вопрос №${num}` : `вопрос #${index + 1} в файле`;
    if (!res.success) {
      for (const i of res.error.issues) {
        const path = i.path.join(".");
        errors.push(`${label}: ${path ? `${path}: ` : ""}${i.message}`);
      }
      return;
    }
    const q = res.data;
    if (seen.has(q.number)) {
      errors.push(`${label}: номер повторяется`);
      return;
    }
    seen.add(q.number);
    if (q.source_id) {
      if (seenSource.has(q.source_id)) {
        errors.push(`${label}: source_id ${q.source_id} повторяется`);
        return;
      }
      seenSource.add(q.source_id);
    }
    const kind = q.kind ?? "choice";
    questions.push({
      number: q.number,
      text: normalizeText(q.text),
      answers: q.answers.map((a) => ({ text: answerText(kind, a.text), isCorrect: a.is_correct })),
      normRef: q.norm_ref ? normalizeText(q.norm_ref) : null,
      explanation: q.explanation === undefined ? undefined : q.explanation ? normalizeText(q.explanation) : null,
      explanationVerified: q.explanation_verified,
      kind,
      sourceId: q.source_id ?? null,
      image: q.image ? parseImage(q.image) : null,
    });
  });
  questions.sort((a, b) => a.number - b.number);
  return { area: top.data.area, questions, errors };
}

function answerText(kind: QuestionKind, raw: string): string {
  const text = normalizeText(raw);
  if (kind !== "match") return text;
  const [left, right] = splitPair(text)!;
  return joinPair(left, right);
}

function parseImage(uri: string): { mime: string; data: string; hash: string } {
  const [, mime, b64] = IMAGE_RE.exec(uri)!;
  const data = b64!.replace(/\s+/g, "");
  return { mime: mime!, data, hash: createHash("sha1").update(data).digest("hex") };
}
