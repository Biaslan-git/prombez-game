import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  answersToday,
  applyAnswer,
  approxReadiness,
  areaStats,
  createKVStore,
  currentStreak,
  emptyAreaProgress,
  emptySession,
  isMastered,
  isMistake,
  mistakeIds,
  parseAreaProgress,
  pickNext,
  pickNextMistake,
  readiness,
  readinessLabel,
  recordAnswer,
  recordExam,
  recordInSession,
  type AreaProgress,
  type QuestionProgress,
} from "./index";

const NOW = new Date(2026, 9, 11, 12, 0, 0).getTime();

function q(partial: Partial<QuestionProgress>): QuestionProgress {
  return { box: 1, attempts: 1, wrong: 0, lastAnsweredAt: NOW, nextReviewAt: NOW, lastResults: [true], ...partial };
}

function withQuestions(questions: Record<number, QuestionProgress>): AreaProgress {
  return { ...emptyAreaProgress(), questions };
}

describe("Leitner", () => {
  it("moves box up on correct answer, capped at 5", () => {
    expect(applyAnswer(undefined, true, NOW).box).toBe(1);
    expect(applyAnswer(q({ box: 2 }), true, NOW).box).toBe(3);
    expect(applyAnswer(q({ box: 5 }), true, NOW).box).toBe(5);
  });

  it("resets box to 1 on wrong answer", () => {
    expect(applyAnswer(q({ box: 4 }), false, NOW).box).toBe(1);
    expect(applyAnswer(undefined, false, NOW).box).toBe(1);
  });

  it("schedules next review by box interval", () => {
    expect(applyAnswer(undefined, true, NOW).nextReviewAt).toBe(NOW); // box 1 — в этой сессии
    expect(applyAnswer(q({ box: 1 }), true, NOW).nextReviewAt).toBe(NOW + DAY_MS); // box 2
    expect(applyAnswer(q({ box: 2 }), true, NOW).nextReviewAt).toBe(NOW + 3 * DAY_MS);
    expect(applyAnswer(q({ box: 3 }), true, NOW).nextReviewAt).toBe(NOW + 7 * DAY_MS);
    expect(applyAnswer(q({ box: 4 }), true, NOW).nextReviewAt).toBe(NOW + 14 * DAY_MS);
    expect(applyAnswer(q({ box: 4 }), false, NOW).nextReviewAt).toBe(NOW);
  });

  it("counts attempts, wrong and keeps last 3 results", () => {
    let p = applyAnswer(undefined, true, NOW);
    p = applyAnswer(p, false, NOW);
    p = applyAnswer(p, true, NOW);
    p = applyAnswer(p, true, NOW);
    expect(p.attempts).toBe(4);
    expect(p.wrong).toBe(1);
    expect(p.lastResults).toEqual([false, true, true]);
  });
});

describe("readiness", () => {
  it("mastered requires box >= 3 and last answer correct", () => {
    expect(isMastered(q({ box: 3, lastResults: [true] }))).toBe(true);
    expect(isMastered(q({ box: 2, lastResults: [true] }))).toBe(false);
    expect(isMastered(q({ box: 3, lastResults: [true, false] }))).toBe(false);
    expect(isMastered(undefined)).toBe(false);
  });

  it("computes rounded percent over active questions only", () => {
    const p = withQuestions({
      1: q({ box: 3, lastResults: [true] }),
      2: q({ box: 5, lastResults: [true] }),
      3: q({ box: 1, lastResults: [false] }),
      99: q({ box: 5, lastResults: [true] }), // неактивный вопрос не учитывается
    });
    expect(readiness(p, [1, 2, 3])).toBe(67);
    expect(readiness(p, [])).toBe(0);
    expect(readiness(emptyAreaProgress(), [1, 2])).toBe(0);
  });

  it("approximate readiness is capped at 100", () => {
    const p = withQuestions({ 1: q({ box: 3 }), 2: q({ box: 3 }) });
    expect(approxReadiness(p, 1)).toBe(100);
    expect(approxReadiness(p, 4)).toBe(50);
    expect(approxReadiness(p, 0)).toBe(0);
  });

  it("labels", () => {
    expect(readinessLabel(0)).toBe("Только начали");
    expect(readinessLabel(39)).toBe("Только начали");
    expect(readinessLabel(40)).toBe("Уже неплохо");
    expect(readinessLabel(69)).toBe("Уже неплохо");
    expect(readinessLabel(70)).toBe("Почти готовы");
    expect(readinessLabel(89)).toBe("Почти готовы");
    expect(readinessLabel(90)).toBe("Готовы к экзамену");
    expect(readinessLabel(100)).toBe("Готовы к экзамену");
  });

  it("stats and mistakes", () => {
    const p = withQuestions({
      1: q({ box: 3, lastResults: [true] }),
      2: q({ box: 1, lastResults: [true, false] }),
      3: q({ box: 2, lastResults: [false, true, true] }),
      4: q({ box: 4, lastResults: [false, true, true] }), // box >= 3 — уже не ошибка
    });
    expect(isMistake(p.questions[2])).toBe(true);
    expect(isMistake(p.questions[4])).toBe(false);
    expect(mistakeIds(p, [1, 2, 3, 4, 5])).toEqual([2, 3]);
    expect(areaStats(p, [1, 2, 3, 4, 5])).toEqual({ total: 5, studied: 4, mastered: 2, mistakes: 2, readiness: 40 });
  });
});

describe("pickNext", () => {
  const ids = [10, 11, 12, 13, 14, 15, 16, 17];

  it("returns null for empty bank", () => {
    expect(pickNext([], emptyAreaProgress(), emptySession(), NOW)).toBeNull();
  });

  it("starts with new questions in number order", () => {
    expect(pickNext(ids, emptyAreaProgress(), emptySession(), NOW)).toEqual({ id: 10, reason: "new" });
  });

  it("prefers overdue questions, lower box first", () => {
    const p = withQuestions({
      10: q({ box: 4, nextReviewAt: NOW - 1000 }),
      11: q({ box: 2, nextReviewAt: NOW - 10 }),
      12: q({ box: 3, nextReviewAt: NOW + DAY_MS }),
    });
    expect(pickNext(ids, p, emptySession(), NOW)).toEqual({ id: 11, reason: "due" });
  });

  it("goes to new questions when nothing is overdue", () => {
    const p = withQuestions({ 10: q({ box: 2, nextReviewAt: NOW + DAY_MS }) });
    expect(pickNext(ids, p, emptySession(), NOW)).toEqual({ id: 11, reason: "new" });
  });

  it("when everything is learned shows earliest nextReviewAt with reason ahead", () => {
    const p = withQuestions({
      1: q({ box: 3, nextReviewAt: NOW + 5 * DAY_MS }),
      2: q({ box: 2, nextReviewAt: NOW + DAY_MS }),
      3: q({ box: 4, nextReviewAt: NOW + 2 * DAY_MS }),
    });
    expect(pickNext([1, 2, 3], p, emptySession(), NOW)).toEqual({ id: 2, reason: "ahead" });
  });

  it("does not repeat recently shown questions while alternatives exist", () => {
    let progress = emptyAreaProgress();
    let session = emptySession();
    const shown: number[] = [];
    for (let i = 0; i < 6; i++) {
      const pick = pickNext(ids, progress, session, NOW)!;
      shown.push(pick.id);
      progress = recordAnswer(progress, pick.id, true, NOW);
      session = recordInSession(session, pick.id, true);
    }
    // Верно отвеченный новый вопрос попадает в ячейку 1 (повтор в этой же сессии), но не сразу.
    expect(shown).toEqual([10, 11, 12, 13, 14, 15]);
    expect(pickNext(ids, progress, session, NOW)).toEqual({ id: 10, reason: "due" });
  });

  it("repeats a wrong answer after 3–5 questions in the same session", () => {
    let progress = emptyAreaProgress();
    let session = emptySession();
    const sequence: number[] = [];
    for (let i = 0; i < 8; i++) {
      const pick = pickNext(ids, progress, session, NOW)!;
      sequence.push(pick.id);
      const correct = !(pick.id === 10 && i === 0);
      progress = recordAnswer(progress, pick.id, correct, NOW);
      session = recordInSession(session, pick.id, correct);
    }
    const repeatAt = sequence.indexOf(10, 1);
    expect(repeatAt - 1).toBeGreaterThanOrEqual(3);
    expect(repeatAt - 1).toBeLessThanOrEqual(5);
  });

  it("never returns the same question twice in a row when there is a choice", () => {
    let progress = emptyAreaProgress();
    let session = emptySession();
    let prev = -1;
    for (let i = 0; i < 30; i++) {
      const pick = pickNext([1, 2], progress, session, NOW)!;
      expect(pick.id).not.toBe(prev);
      prev = pick.id;
      progress = recordAnswer(progress, pick.id, i % 3 !== 0, NOW);
      session = recordInSession(session, pick.id, i % 3 !== 0);
    }
  });

  it("works with a single question", () => {
    const p = withQuestions({ 1: q({ box: 1 }) });
    const s = recordInSession(emptySession(), 1, true);
    expect(pickNext([1], p, s, NOW)?.id).toBe(1);
  });
});

describe("pickNextMistake", () => {
  it("cycles until each mistake is answered correctly", () => {
    const p = withQuestions({ 1: q({ box: 2 }), 2: q({ box: 1 }) });
    let session = emptySession();
    const solved = new Set<number>();
    expect(pickNextMistake([1, 2], p, session, solved)).toBe(2); // меньшая ячейка первой
    session = recordInSession(session, 2, false);
    expect(pickNextMistake([1, 2], p, session, solved)).toBe(1);
    session = recordInSession(session, 1, true);
    solved.add(1);
    expect(pickNextMistake([1, 2], p, session, solved)).toBe(2);
    solved.add(2);
    expect(pickNextMistake([1, 2], p, session, solved)).toBeNull();
  });
});

describe("streak", () => {
  it("counts a day after 10 answers and continues next day", () => {
    let p = emptyAreaProgress();
    for (let i = 0; i < 9; i++) p = recordAnswer(p, i, true, NOW);
    expect(currentStreak(p, NOW)).toBe(0);
    expect(answersToday(p, NOW)).toBe(9);
    p = recordAnswer(p, 9, true, NOW);
    expect(currentStreak(p, NOW)).toBe(1);
    p = recordAnswer(p, 10, true, NOW); // 11-й ответ в тот же день не увеличивает серию
    expect(currentStreak(p, NOW)).toBe(1);

    const tomorrow = NOW + DAY_MS;
    expect(currentStreak(p, tomorrow)).toBe(1); // ещё не прервана
    for (let i = 0; i < 10; i++) p = recordAnswer(p, i, true, tomorrow);
    expect(currentStreak(p, tomorrow)).toBe(2);

    expect(currentStreak(p, tomorrow + 2 * DAY_MS)).toBe(0); // пропуск дня
    const later = tomorrow + 3 * DAY_MS;
    for (let i = 0; i < 10; i++) p = recordAnswer(p, i, true, later);
    expect(currentStreak(p, later)).toBe(1);
  });
});

describe("recordExam", () => {
  it("updates questions like training and stores exam", () => {
    const p = recordExam(
      withQuestions({ 1: q({ box: 4, lastResults: [true] }) }),
      [
        { questionId: 1, correct: false },
        { questionId: 2, correct: true },
      ],
      { at: NOW, correct: 1, total: 2, passed: false },
    );
    expect(p.questions[1]!.box).toBe(1);
    expect(p.questions[2]!.box).toBe(1);
    expect(p.exams).toEqual([{ at: NOW, correct: 1, total: 2, passed: false }]);
  });
});

describe("storage", () => {
  function memory() {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
  }

  it("round-trips progress", () => {
    const kv = memory();
    const store = createKVStore(() => kv);
    const p = recordAnswer(emptyAreaProgress(), 5, true, NOW);
    store.save("a1", p);
    expect(kv.m.has("pg:v1:progress:a1")).toBe(true);
    expect(store.load("a1")).toEqual(p);
  });

  it("returns empty progress on broken data or failing storage", () => {
    const kv = memory();
    kv.setItem("pg:v1:progress:a1", "{not json");
    expect(createKVStore(() => kv).load("a1")).toEqual(emptyAreaProgress());
    const throwing = createKVStore(() => ({
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
    }));
    expect(throwing.load("a1")).toEqual(emptyAreaProgress());
    expect(() => throwing.save("a1", emptyAreaProgress())).not.toThrow();
    expect(createKVStore(() => null).load("a1")).toEqual(emptyAreaProgress());
  });

  it("drops invalid entries but keeps valid ones", () => {
    const parsed = parseAreaProgress({
      version: 1,
      questions: { "1": { box: 2, nextReviewAt: NOW, lastResults: [true, "x"] }, "2": { box: 9 }, abc: { box: 1, nextReviewAt: 0 } },
      exams: [{ at: NOW, correct: 1, total: 2, passed: true }, null],
    });
    expect(Object.keys(parsed.questions)).toEqual(["1"]);
    expect(parsed.questions[1]!.lastResults).toEqual([true]);
    expect(parsed.exams).toHaveLength(1);
    expect(parseAreaProgress({ version: 2 })).toEqual(emptyAreaProgress());
  });
});
