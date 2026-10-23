import { describe, expect, it } from "vitest";
import { buildPollRequest, dayNumber, isPollable, pickDailyQuestion, type PollCandidate } from "./telegram";

const cand = (id: number, over: Partial<PollCandidate> = {}): PollCandidate => ({
  id,
  areaSlug: "a1",
  slug: `q-${id}`,
  text: `Вопрос ${id}?`,
  normRef: "Статья 9 № 116-ФЗ",
  answers: [
    { text: "Первый", isCorrect: false },
    { text: "Второй", isCorrect: true },
    { text: "Третий", isCorrect: false },
  ],
  ...over,
});

describe("isPollable", () => {
  it("принимает вопрос с одним верным ответом в лимитах", () => {
    expect(isPollable(cand(1))).toBe(true);
  });
  it("отклоняет длинный текст, длинный вариант, несколько верных и много вариантов", () => {
    expect(isPollable(cand(1, { text: "а".repeat(301) }))).toBe(false);
    expect(
      isPollable(
        cand(1, {
          answers: [
            { text: "а".repeat(101), isCorrect: true },
            { text: "б", isCorrect: false },
          ],
        }),
      ),
    ).toBe(false);
    expect(
      isPollable(
        cand(1, {
          answers: [
            { text: "а", isCorrect: true },
            { text: "б", isCorrect: true },
          ],
        }),
      ),
    ).toBe(false);
    const many = Array.from({ length: 11 }, (_, i) => ({ text: `в${i}`, isCorrect: i === 0 }));
    expect(isPollable(cand(1, { answers: many }))).toBe(false);
  });
});

describe("pickDailyQuestion", () => {
  const pool = Array.from({ length: 5 }, (_, i) => cand(i + 1));
  it("один и тот же вопрос в течение суток", () => {
    const a = pickDailyQuestion(pool, new Date("2026-10-23T05:00:00Z"));
    const b = pickDailyQuestion(pool, new Date("2026-10-23T18:00:00Z"));
    expect(a?.id).toBe(b?.id);
  });
  it("за N дней проходит все вопросы без повторов", () => {
    const ids = new Set(
      Array.from({ length: 5 }, (_, d) => pickDailyQuestion(pool, new Date(Date.UTC(2026, 9, 23 + d, 6)))!.id),
    );
    expect(ids.size).toBe(5);
  });
  it("пропускает неподходящие и возвращает null на пустом пуле", () => {
    expect(pickDailyQuestion([cand(1, { text: "а".repeat(400) })], new Date())).toBeNull();
  });
  it("номер дня считается по Москве", () => {
    expect(dayNumber(new Date("2026-10-23T20:59:00Z"))).toBe(dayNumber(new Date("2026-10-23T00:00:00Z")));
    expect(dayNumber(new Date("2026-10-23T21:00:00Z"))).toBe(dayNumber(new Date("2026-10-23T00:00:00Z")) + 1);
  });
});

describe("buildPollRequest", () => {
  it("собирает quiz с верным индексом, пояснением и кнопкой на сайт", () => {
    const req = buildPollRequest(cand(7), "@chan", "https://prombez-game.ru/", new Date("2026-10-23T06:00:00Z"));
    expect(req.type).toBe("quiz");
    expect(req.options).toHaveLength(3);
    expect(req.options[req.correct_option_id]).toBe("Второй");
    expect(req.explanation).toBe("Норма: Статья 9 № 116-ФЗ");
    expect(req.reply_markup.inline_keyboard[0]![0]!.url).toBe("https://prombez-game.ru/a1/q/q-7?utm_source=telegram");
  });
});

import { parseUpdate } from "./telegram";

describe("parseUpdate", () => {
  const msg = (text: string, type = "private") => ({
    message: { text, chat: { id: 42, type }, from: { username: "ivan" } },
  });

  it("разбирает команды, в том числе с аргументом и @ботом", () => {
    expect(parseUpdate(msg("/start site"))).toEqual({ chatId: "42", username: "ivan", command: "start" });
    expect(parseUpdate(msg("/stop@prombez_bot"))?.command).toBe("stop");
    expect(parseUpdate(msg("/Question"))?.command).toBe("question");
    expect(parseUpdate(msg("/help"))?.command).toBe("help");
  });

  it("обычный текст и неизвестные команды — text", () => {
    expect(parseUpdate(msg("привет"))?.command).toBe("text");
    expect(parseUpdate(msg("/unknown"))?.command).toBe("text");
  });

  it("игнорирует группы и не-сообщения", () => {
    expect(parseUpdate(msg("/start", "group"))).toBeNull();
    expect(parseUpdate({ edited_message: {} })).toBeNull();
    expect(parseUpdate(null)).toBeNull();
  });
});
