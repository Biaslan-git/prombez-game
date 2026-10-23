import { describe, expect, it } from "vitest";
import { isPollable, type PollCandidate } from "./poll-questions";

const cand = (over: Partial<PollCandidate> = {}): PollCandidate => ({
  id: 1,
  areaSlug: "a1",
  slug: "q-1",
  text: "Вопрос?",
  normRef: null,
  answers: [
    { text: "Первый", isCorrect: false },
    { text: "Второй", isCorrect: true },
  ],
  ...over,
});

describe("isPollable", () => {
  it("принимает вопрос с одним верным ответом в лимитах", () => {
    expect(isPollable(cand())).toBe(true);
  });

  it("отклоняет длинный текст, длинный вариант, несколько верных и много вариантов", () => {
    expect(isPollable(cand({ text: "а".repeat(301) }))).toBe(false);
    expect(
      isPollable(
        cand({
          answers: [
            { text: "а".repeat(101), isCorrect: true },
            { text: "б", isCorrect: false },
          ],
        }),
      ),
    ).toBe(false);
    expect(
      isPollable(
        cand({
          answers: [
            { text: "а", isCorrect: true },
            { text: "б", isCorrect: true },
          ],
        }),
      ),
    ).toBe(false);
    const many = Array.from({ length: 11 }, (_, i) => ({ text: `в${i}`, isCorrect: i === 0 }));
    expect(isPollable(cand({ answers: many }))).toBe(false);
  });
});
