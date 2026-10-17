import { describe, expect, it } from "vitest";
import { pickCanonicals, type DupItem } from "./canonical";

const item = (over: Partial<DupItem>): DupItem => ({
  id: 1,
  areaSlug: "a1",
  areaCode: "А.1",
  number: 1,
  slug: "q1",
  text: "Кто отвечает?",
  correct: ["Директор"],
  ...over,
});

describe("pickCanonicals", () => {
  it("главной считает вопрос из области, код которой идёт первым (А.1 раньше Б)", () => {
    const a = item({ id: 1, areaSlug: "b1-1", areaCode: "Б.1.1", slug: "b-q" });
    const b = item({ id: 2, areaSlug: "a1", slug: "a-q" });
    const map = pickCanonicals([a, b]);
    expect(map.get(1)).toEqual({ areaSlug: "a1", slug: "a-q" });
    expect(map.has(2)).toBe(false);
  });

  it("не различает регистр, пробелы и знаки в конце", () => {
    const a = item({ id: 1 });
    const b = item({ id: 2, areaSlug: "b1-1", slug: "x", text: "кто  отвечает" });
    expect(pickCanonicals([a, b]).get(2)).toEqual({ areaSlug: "a1", slug: "q1" });
  });

  it("не склеивает вопросы с разными верными ответами или уникальные", () => {
    const a = item({ id: 1 });
    const b = item({ id: 2, areaSlug: "b1-1", correct: ["Инспектор"] });
    const c = item({ id: 3, text: "Другой вопрос" });
    expect(pickCanonicals([a, b, c]).size).toBe(0);
  });

  it("порядок верных ответов не важен", () => {
    const a = item({ id: 1, correct: ["А", "Б"] });
    const b = item({ id: 2, areaSlug: "b1-1", correct: ["Б", "А"] });
    expect(pickCanonicals([a, b]).size).toBe(1);
  });

  it("сравнивает коды по-человечески: Б.1.2 раньше Б.1.10", () => {
    const a = item({ id: 1, areaSlug: "b1-10", areaCode: "Б.1.10", slug: "ten" });
    const b = item({ id: 2, areaSlug: "b1-2", areaCode: "Б.1.2", slug: "two" });
    expect(pickCanonicals([a, b]).get(1)).toEqual({ areaSlug: "b1-2", slug: "two" });
  });

  it("при равных областях выбирает меньший номер", () => {
    const a = item({ id: 1, number: 5, slug: "five" });
    const b = item({ id: 2, number: 2, slug: "two" });
    expect(pickCanonicals([a, b]).get(1)).toEqual({ areaSlug: "a1", slug: "two" });
  });
});
