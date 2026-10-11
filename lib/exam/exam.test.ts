import { describe, expect, it } from "vitest";
import {
  formatClock,
  generateTicket,
  isAnswerCorrect,
  remainingMs,
  scoreExam,
  seededRng,
  shuffle,
  shuffleAnswers,
  type ExamQuestion,
} from "./index";

function makePool(n: number): ExamQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    number: i + 1,
    text: `Вопрос ${i + 1}`,
    answers: [
      { id: (i + 1) * 10 + 1, text: "верно", isCorrect: true },
      { id: (i + 1) * 10 + 2, text: "неверно", isCorrect: false },
      { id: (i + 1) * 10 + 3, text: "неверно 2", isCorrect: false },
    ],
  }));
}

const NOW = 1_760_000_000_000;

describe("shuffle", () => {
  it("is a permutation and deterministic with seeded rng", () => {
    const a = shuffle([1, 2, 3, 4, 5], seededRng(1));
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(shuffle([1, 2, 3, 4, 5], seededRng(1))).toEqual(a);
  });
});

describe("generateTicket", () => {
  it("takes count unique random questions with all their answers", () => {
    const t = generateTicket(makePool(30), { count: 20, timeLimitMin: 20, passThreshold: 18, now: NOW }, seededRng(42));
    expect(t.questions).toHaveLength(20);
    expect(new Set(t.questions.map((q) => q.id)).size).toBe(20);
    for (const q of t.questions)
      expect(q.answers.map((a) => a.id).sort()).toEqual([q.id * 10 + 1, q.id * 10 + 2, q.id * 10 + 3]);
    expect(t.timeLimitMs).toBe(20 * 60_000);
    expect(t.passThreshold).toBe(18);
    expect(t.startedAt).toBe(NOW);
  });

  it("shuffles answer order", () => {
    const t = generateTicket(makePool(30), { count: 30, timeLimitMin: 20, passThreshold: 18, now: NOW }, seededRng(7));
    const firstIsCorrect = t.questions.filter((q) => q.answers[0]!.isCorrect).length;
    expect(firstIsCorrect).toBeLessThan(30);
  });

  it("scales threshold when bank is smaller than regulation", () => {
    const t = generateTicket(makePool(10), { count: 20, timeLimitMin: 20, passThreshold: 18, now: NOW }, seededRng(1));
    expect(t.questions).toHaveLength(10);
    expect(t.passThreshold).toBe(9);
  });
});

describe("scoring", () => {
  const multi: ExamQuestion = {
    id: 100,
    number: 100,
    text: "multi",
    answers: [
      { id: 1, text: "a", isCorrect: true },
      { id: 2, text: "b", isCorrect: true },
      { id: 3, text: "c", isCorrect: false },
    ],
  };

  it("multi-answer question requires exact set", () => {
    expect(isAnswerCorrect(multi, [1, 2])).toBe(true);
    expect(isAnswerCorrect(multi, [2, 1])).toBe(true);
    expect(isAnswerCorrect(multi, [1])).toBe(false);
    expect(isAnswerCorrect(multi, [1, 2, 3])).toBe(false);
    expect(isAnswerCorrect(multi, [])).toBe(false);
    expect(isAnswerCorrect(multi, undefined)).toBe(false);
  });

  it("counts correct answers, pass/fail and lists mistakes", () => {
    const t = generateTicket(makePool(5), { count: 5, timeLimitMin: 5, passThreshold: 4, now: NOW }, seededRng(3));
    const responses: Record<number, number[]> = {};
    t.questions.forEach((q, i) => {
      if (i === 0) return; // без ответа — ошибка
      responses[q.id] = [q.answers.find((a) => a.isCorrect === (i !== 1))!.id];
    });
    const r = scoreExam(t, responses);
    expect(r.total).toBe(5);
    expect(r.correct).toBe(3);
    expect(r.passed).toBe(false);
    expect(r.mistakes.map((m) => m.question.id)).toEqual([t.questions[0]!.id, t.questions[1]!.id]);
    expect(r.mistakes[0]!.selected).toEqual([]);

    responses[t.questions[0]!.id] = [t.questions[0]!.answers.find((a) => a.isCorrect)!.id];
    expect(scoreExam(t, responses).passed).toBe(true);
  });

  it("empty ticket is never passed", () => {
    const t = generateTicket([], { count: 20, timeLimitMin: 20, passThreshold: 18, now: NOW });
    expect(scoreExam(t, {}).passed).toBe(false);
  });
});

describe("timer", () => {
  it("remaining time and clock format", () => {
    const t = generateTicket(makePool(3), { count: 3, timeLimitMin: 2, passThreshold: 2, now: NOW });
    expect(remainingMs(t, NOW + 30_000)).toBe(90_000);
    expect(remainingMs(t, NOW + 10 * 60_000)).toBe(0);
    expect(formatClock(90_000)).toBe("01:30");
    expect(formatClock(1)).toBe("00:01");
    expect(formatClock(0)).toBe("00:00");
  });
});

describe("shuffleAnswers", () => {
  const opts = (texts: string[]) => texts.map((text, i) => ({ id: i + 1, text, isCorrect: i === 0 }));

  it("keeps the same answers with their correctness flags", () => {
    const src = opts(["а", "б", "в", "г"]);
    const out = shuffleAnswers(src, seededRng(5));
    expect(out.map((a) => a.id).sort()).toEqual([1, 2, 3, 4]);
    expect(out.find((a) => a.id === 1)!.isCorrect).toBe(true);
    expect(src.map((a) => a.id)).toEqual([1, 2, 3, 4]); // исходный массив не меняется
  });

  it("is deterministic with a seeded rng", () => {
    const src = opts(["а", "б", "в", "г"]);
    expect(shuffleAnswers(src, seededRng(9))).toEqual(shuffleAnswers(src, seededRng(9)));
  });

  it("keeps «all of the above» style options last", () => {
    for (const tail of [
      "Все перечисленное.",
      "Все перечисленные варианты",
      "Ни один из перечисленных",
      "Ничего из перечисленного",
    ]) {
      for (let seed = 1; seed <= 20; seed++) {
        const out = shuffleAnswers(opts(["а", "б", tail, "г"]), seededRng(seed));
        expect(out[out.length - 1]!.text).toBe(tail);
      }
    }
  });

  it("does not pin ordinary answers that merely start with «все»", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      const out = shuffleAnswers(opts(["Все организации независимо от формы", "б", "в", "г"]), seededRng(seed));
      seen.add(out.findIndex((a) => a.id === 1));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("spreads the correct answer evenly over positions", () => {
    const counts = [0, 0, 0, 0];
    const rng = seededRng(2026);
    for (let i = 0; i < 2000; i++)
      counts[shuffleAnswers(opts(["а", "б", "в", "г"]), rng).findIndex((a) => a.isCorrect)]!++;
    for (const c of counts) {
      expect(c / 2000).toBeGreaterThan(0.2);
      expect(c / 2000).toBeLessThan(0.3);
    }
  });
});
