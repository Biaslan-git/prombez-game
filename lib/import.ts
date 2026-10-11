import { z } from "zod";
import { normalizeText } from "./text";

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
  })
  .refine((q) => q.answers.some((a) => a.is_correct), {
    message: "нет ни одного правильного ответа",
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
    questions.push({
      number: q.number,
      text: normalizeText(q.text),
      answers: q.answers.map((a) => ({ text: normalizeText(a.text), isCorrect: a.is_correct })),
      normRef: q.norm_ref ? normalizeText(q.norm_ref) : null,
      explanation: q.explanation === undefined ? undefined : q.explanation ? normalizeText(q.explanation) : null,
      explanationVerified: q.explanation_verified,
    });
  });
  questions.sort((a, b) => a.number - b.number);
  return { area: top.data.area, questions, errors };
}
