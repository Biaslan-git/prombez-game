import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPoll, dayNumber, pickDailyQuestion } from "../tgcloud/lib/daily.js";
import { parseCommand } from "../tgcloud/lib/texts.js";
import { shuffleAnswers, seededRng } from "../tgcloud/lib/rng.js";
import { QUESTIONS } from "../tgcloud/lib/questions.js";

const q = (id, over = {}) => ({
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

test("вопрос дня не меняется в течение суток", () => {
  const pool = [1, 2, 3, 4, 5].map((i) => q(i));
  const a = pickDailyQuestion(pool, new Date("2026-10-23T05:00:00Z"));
  const b = pickDailyQuestion(pool, new Date("2026-10-23T18:00:00Z"));
  assert.equal(a.id, b.id);
});

test("за N дней проходит все вопросы без повторов", () => {
  const pool = [1, 2, 3, 4, 5].map((i) => q(i));
  const ids = new Set(
    Array.from({ length: 5 }, (_, d) => pickDailyQuestion(pool, new Date(Date.UTC(2026, 9, 23 + d, 6))).id),
  );
  assert.equal(ids.size, 5);
});

test("пустой список — null", () => {
  assert.equal(pickDailyQuestion([], new Date()), null);
});

test("номер дня считается по Москве", () => {
  const base = dayNumber(new Date("2026-10-23T00:00:00Z"));
  assert.equal(dayNumber(new Date("2026-10-23T20:59:00Z")), base);
  assert.equal(dayNumber(new Date("2026-10-23T21:00:00Z")), base + 1);
});

test("sendPoll: quiz с верным индексом, нормой и кнопкой на сайт", () => {
  const poll = buildPoll(q(7), 42, new Date("2026-10-23T06:00:00Z"));
  assert.equal(poll.type, "quiz");
  assert.equal(poll.options.length, 3);
  assert.equal(poll.options[poll.correct_option_id], "Второй");
  assert.equal(poll.explanation, "Норма: Статья 9 № 116-ФЗ");
  assert.equal(poll.reply_markup.inline_keyboard[0][0].url, "https://prombez-game.ru/a1/q/q-7?utm_source=telegram");
});

test("«Все перечисленное» остаётся последним вариантом", () => {
  const answers = [
    { text: "А", isCorrect: false },
    { text: "Все перечисленное.", isCorrect: true },
    { text: "Б", isCorrect: false },
  ];
  for (let seed = 1; seed < 20; seed++) {
    assert.equal(shuffleAnswers(answers, seededRng(seed)).at(-1).text, "Все перечисленное.");
  }
});

test("команды бота", () => {
  assert.equal(parseCommand("/start site"), "start");
  assert.equal(parseCommand("/stop@prombez_game_bot"), "stop");
  assert.equal(parseCommand("/Question"), "question");
  assert.equal(parseCommand("привет"), "text");
  assert.equal(parseCommand(undefined), "text");
});

test("зашитые вопросы укладываются в лимиты Telegram", () => {
  assert.ok(QUESTIONS.length > 30);
  for (const x of QUESTIONS) {
    assert.ok(x.text.length <= 300, `вопрос ${x.id}`);
    assert.equal(x.answers.filter((a) => a.isCorrect).length, 1, `вопрос ${x.id}`);
    for (const a of x.answers) assert.ok(a.text.length <= 100, `вопрос ${x.id}`);
  }
});
