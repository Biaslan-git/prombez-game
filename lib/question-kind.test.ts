import { describe, expect, it } from "vitest";
import { isAnswerCorrect } from "./exam";
import { isSequenceCorrect, splitPair } from "./question-kind";

describe("splitPair", () => {
  it("splits on --- and on a spaced dash", () => {
    expect(splitPair("Риск краткосрочный --- Выполнение работ")).toEqual(["Риск краткосрочный", "Выполнение работ"]);
    expect(splitPair("Плечевая артерия ---2.")).toEqual(["Плечевая артерия", "2."]);
    expect(splitPair("Мотив конформизма - Стремление")).toEqual(["Мотив конформизма", "Стремление"]);
    expect(splitPair("Бета-излучение")).toBeNull();
  });
});

describe("sequence answers", () => {
  const order = [
    { id: 11, text: "Первое", position: 0, isCorrect: true },
    { id: 12, text: "Второе", position: 1, isCorrect: true },
    { id: 13, text: "Третье", position: 2, isCorrect: true },
  ];

  it("order: correct only in the stored order and only when complete", () => {
    expect(isSequenceCorrect("order", order, [11, 12, 13])).toBe(true);
    expect(isSequenceCorrect("order", order, [12, 11, 13])).toBe(false);
    expect(isSequenceCorrect("order", order, [11, 12])).toBe(false);
    // Варианты пришли перемешанными — решение берётся по position.
    expect(isSequenceCorrect("order", [order[2]!, order[0]!, order[1]!], [11, 12, 13])).toBe(true);
  });

  it("match: equal right parts are interchangeable", () => {
    const match = [
      { id: 1, text: "Рисунок 1 --- Признаки жизни", position: 0, isCorrect: true },
      { id: 2, text: "Рисунок 2 --- Признаки жизни", position: 1, isCorrect: true },
      { id: 3, text: "Рисунок 3 --- Осмотр", position: 2, isCorrect: true },
    ];
    expect(isSequenceCorrect("match", match, [2, 1, 3])).toBe(true);
    expect(isSequenceCorrect("match", match, [3, 1, 2])).toBe(false);
  });

  it("isAnswerCorrect dispatches by kind", () => {
    const q = { id: 1, number: 1, text: "?", kind: "order", answers: order };
    expect(isAnswerCorrect(q, [11, 12, 13])).toBe(true);
    // Как обычный вопрос с несколькими ответами порядок был бы не важен.
    expect(isAnswerCorrect(q, [13, 12, 11])).toBe(false);
  });
});
