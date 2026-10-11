import { describe, expect, it } from "vitest";
import { parseImportFile } from "./import";

const area = { code: "А.1", title: "Основы промышленной безопасности" };

describe("parseImportFile", () => {
  it("normalizes valid questions", () => {
    const r = parseImportFile({
      area,
      questions: [
        { number: 2, text: 'Что  такое "ОПО"?', answers: [{ text: "а", is_correct: true }, { text: "б", is_correct: false }] },
        { number: 1, text: "Q1", answers: [{ text: "а", is_correct: false }, { text: "б", is_correct: true }], norm_ref: "п. 1" },
      ],
    });
    expect(r.errors).toEqual([]);
    expect(r.questions.map((q) => q.number)).toEqual([1, 2]);
    expect(r.questions[1]!.text).toBe("Что такое «ОПО»?");
    expect(r.questions[0]!.normRef).toBe("п. 1");
    expect(r.questions[0]!.explanation).toBeUndefined();
  });

  it("reports errors with question numbers", () => {
    const r = parseImportFile({
      area,
      questions: [
        { number: 5, text: "нет правильного", answers: [{ text: "а", is_correct: false }, { text: "б", is_correct: false }] },
        { number: 6, text: "один вариант", answers: [{ text: "а", is_correct: true }] },
        { number: 6, text: "дубль", answers: [{ text: "а", is_correct: true }, { text: "б", is_correct: false }] },
        { text: "без номера", answers: [] },
      ],
    });
    expect(r.errors.some((e) => e.startsWith("вопрос №5") && e.includes("нет ни одного правильного"))).toBe(true);
    expect(r.errors.some((e) => e.startsWith("вопрос №6") && e.includes("двух вариантов"))).toBe(true);
    expect(r.errors.some((e) => e.startsWith("вопрос #4"))).toBe(true);
    expect(r.questions).toHaveLength(1);
  });

  it("rejects broken file structure", () => {
    expect(parseImportFile({ questions: [] }).errors.length).toBeGreaterThan(0);
  });
});
