import { describe, expect, it } from "vitest";
import { parseImportFile } from "./import";

const area = { code: "А.1", title: "Основы промышленной безопасности" };

describe("parseImportFile", () => {
  it("normalizes valid questions", () => {
    const r = parseImportFile({
      area,
      questions: [
        {
          number: 2,
          text: 'Что  такое "ОПО"?',
          answers: [
            { text: "а", is_correct: true },
            { text: "б", is_correct: false },
          ],
        },
        {
          number: 1,
          text: "Q1",
          answers: [
            { text: "а", is_correct: false },
            { text: "б", is_correct: true },
          ],
          norm_ref: "п. 1",
        },
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
        {
          number: 5,
          text: "нет правильного",
          answers: [
            { text: "а", is_correct: false },
            { text: "б", is_correct: false },
          ],
        },
        { number: 6, text: "один вариант", answers: [{ text: "а", is_correct: true }] },
        {
          number: 6,
          text: "дубль",
          answers: [
            { text: "а", is_correct: true },
            { text: "б", is_correct: false },
          ],
        },
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

describe("parseImportFile: kinds, source ids, images", () => {
  const png = "data:image/png;base64,iVBORw0KGgo=";
  const two = [
    { text: "Первое --- 1", is_correct: true },
    { text: "Второе  ---   2", is_correct: true },
  ];

  it("accepts order/match questions, normalizes pairs and parses images", () => {
    const r = parseImportFile({
      area: { ...area, course: "prombez", section: null, authority: "Ростехнадзора" },
      questions: [
        { number: 1, source_id: 7, kind: "match", text: "Сопоставьте", answers: two, image: png },
        { number: 2, source_id: 8, kind: "order", text: "Порядок", answers: two },
      ],
    });
    expect(r.errors).toEqual([]);
    expect(r.questions[0]!.answers[1]!.text).toBe("Второе --- 2");
    expect(r.questions[0]!.image).toMatchObject({ mime: "image/png", data: "iVBORw0KGgo=" });
    expect(r.questions[0]!.image!.hash).toMatch(/^[0-9a-f]{40}$/);
    expect(r.questions[1]!.kind).toBe("order");
    expect(r.questions[1]!.sourceId).toBe(8);
    expect(r.area.authority).toBe("Ростехнадзора");
  });

  it("rejects inconsistent kinds, bad images and repeated source ids", () => {
    const r = parseImportFile({
      area,
      questions: [
        {
          number: 1,
          kind: "order",
          text: "q",
          answers: [
            { text: "a", is_correct: true },
            { text: "b", is_correct: false },
          ],
        },
        { number: 2, kind: "match", text: "q", answers: [two[0], { text: "без пары", is_correct: true }] },
        { number: 3, text: "q", answers: two, image: "data:image/emf;base64,AAAA" },
        { number: 4, source_id: 5, text: "q", answers: two },
        { number: 5, source_id: 5, text: "q", answers: two },
      ],
    });
    expect(r.errors.some((e) => e.startsWith("вопрос №1") && e.includes("порядок"))).toBe(true);
    expect(r.errors.some((e) => e.startsWith("вопрос №2") && e.includes("соответствие"))).toBe(true);
    expect(r.errors.some((e) => e.startsWith("вопрос №3") && e.includes("картинка"))).toBe(true);
    expect(r.errors.some((e) => e.startsWith("вопрос №5") && e.includes("source_id"))).toBe(true);
  });
});
