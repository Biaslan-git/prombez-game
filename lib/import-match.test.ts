import { describe, expect, it } from "vitest";
import { matchKey, planNumbers } from "./import-match";

describe("matchKey", () => {
  it("ignores case, punctuation, quotes, ё and the answer-format tail", () => {
    expect(matchKey("Что такое «ОПО»? Выберите правильный вариант ответа.", null)).toBe(
      matchKey('что  такое "опо"', null),
    );
    expect(matchKey("Всё ли ясно?", null)).toBe(matchKey("Все ли ясно", null));
  });

  it("distinguishes questions with different images", () => {
    expect(matchKey("Вопрос по рисунку", "a")).not.toBe(matchKey("Вопрос по рисунку", "b"));
    expect(matchKey("Вопрос по рисунку", "a")).not.toBe(matchKey("Вопрос по рисунку", null));
  });
});

describe("planNumbers", () => {
  const row = (id: number, number: number, key: string, sourceId: number | null = null) => ({
    id,
    number,
    key,
    sourceId,
  });

  it("matches by number when the file has no source ids (old format)", () => {
    const plan = planNumbers([row(1, 1, "a"), row(2, 2, "b")], [{ number: 2, sourceId: null, key: "x" }]);
    expect(plan.items).toEqual([{ number: 2, prevId: 2 }]);
    expect([...plan.claimed]).toEqual([2]);
  });

  it("keeps old numbers for questions recognised by text and appends new ones", () => {
    const existing = [row(10, 1, "a"), row(11, 2, "b"), row(12, 3, "c")];
    const plan = planNumbers(existing, [
      { number: 1, sourceId: 100, key: "c" },
      { number: 2, sourceId: 101, key: "new" },
      { number: 3, sourceId: 102, key: "a" },
    ]);
    expect(plan.items).toEqual([
      { number: 3, prevId: 12 },
      { number: 4, prevId: null },
      { number: 1, prevId: 10 },
    ]);
    expect(plan.matchedByText).toBe(2);
    expect(plan.claimed.has(11)).toBe(false); // «b» пропал — будет деактивирован
  });

  it("prefers source ids and matches each old row once", () => {
    const existing = [row(1, 5, "same", 100), row(2, 6, "same")];
    const plan = planNumbers(existing, [
      { number: 1, sourceId: 200, key: "same" },
      { number: 2, sourceId: 100, key: "other" },
      { number: 3, sourceId: 300, key: "same" },
    ]);
    expect(plan.items).toEqual([
      { number: 6, prevId: 2 },
      { number: 5, prevId: 1 },
      { number: 7, prevId: null },
    ]);
    expect(plan.matchedBySource).toBe(1);
    expect(plan.matchedByText).toBe(1);
  });

  it("uses bank positions as numbers in a new area", () => {
    const plan = planNumbers(
      [],
      [
        { number: 1, sourceId: 1, key: "a" },
        { number: 3, sourceId: 2, key: "b" },
      ],
    );
    expect(plan.items.map((i) => i.number)).toEqual([1, 3]);
  });
});
