import { describe, expect, it } from "vitest";
import { pickQuizQuestions, quizRound } from "./quiz";

const q = (id: number, text: string) => ({ id, text });

describe("pickQuizQuestions", () => {
  const all = [
    q(1, "Про декларацию"),
    q(2, "Ещё декларация"),
    q(3, "Совсем другое"),
    q(4, "Про лицензирование"),
    q(5, "Декларация третья"),
  ];

  it("не включает текущий вопрос и ставит связанные по теме первыми", () => {
    const res = pickQuizQuestions(all, all[0]!, 10);
    expect(res.map((x) => x.id)).not.toContain(1);
    expect(
      res
        .slice(0, 2)
        .map((x) => x.id)
        .sort(),
    ).toEqual([2, 5]);
    expect(res).toHaveLength(4);
  });

  it("детерминирован для одного вопроса", () => {
    expect(pickQuizQuestions(all, all[0]!, 10)).toEqual(pickQuizQuestions(all, all[0]!, 10));
  });

  it("ограничивает число вопросов", () => {
    expect(pickQuizQuestions(all, all[2]!, 2)).toHaveLength(2);
  });
});

describe("quizRound", () => {
  const items = Array.from({ length: 10 }, (_, i) => i);
  it("делит на раунды и идёт по кругу", () => {
    expect(quizRound(items, 0)).toEqual([0, 1, 2, 3, 4]);
    expect(quizRound(items, 1)).toEqual([5, 6, 7, 8, 9]);
    expect(quizRound(items, 2)).toEqual([0, 1, 2, 3, 4]);
  });
  it("короткий список отдаёт целиком", () => {
    expect(quizRound([1, 2], 3)).toEqual([1, 2]);
  });
});
