import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPoll, dailyIndex, dayNumber, randomIndex } from "../tgcloud/lib/daily.js";
import { parseCommand, startArea } from "../tgcloud/lib/texts.js";
import { shuffleAnswers, seededRng } from "../tgcloud/lib/rng.js";

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

test("вопрос дня: подписчик проходит весь пул без повторов", () => {
  for (const n of [1, 2, 6, 97, 1000]) {
    for (const chatId of [1, 42, 123456789, 7000000001]) {
      const seen = new Set();
      for (let d = 0; d < n; d++) seen.add(dailyIndex(n, 20400 + d, chatId));
      assert.equal(seen.size, n, `n=${n}, chat=${chatId}`);
    }
  }
});

test("вопрос дня у разных подписчиков разный, пустой пул — -1", () => {
  const day = dayNumber(new Date("2026-10-25T06:00:00Z"));
  const picks = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((c) => dailyIndex(5000, day, c)));
  assert.ok(picks.size > 4);
  assert.equal(dailyIndex(0, day, 1), -1);
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
  assert.equal(parseCommand("/settings"), "settings");
  assert.equal(parseCommand("привет"), "text");
  assert.equal(parseCommand(undefined), "text");
});

test("/start с сайта со страницы области", () => {
  assert.equal(startArea("/start a_b1-1"), "b1-1");
  assert.equal(startArea("/start home"), null);
  assert.equal(startArea("/start"), null);
});

test("/question даёт случайный номер, не равный вопросу дня", () => {
  for (let i = 0; i < 50; i++) assert.notEqual(randomIndex(3, 1), 1);
  for (let i = 0; i < 50; i++) assert.ok(randomIndex(3, 2) < 2);
  assert.equal(randomIndex(1, 0), 0);
  assert.equal(randomIndex(0, -1), -1);
});

test("верный ответ не прилипает к одной позиции в разные дни", () => {
  const positions = new Set();
  for (let d = 0; d < 40; d++) {
    const poll = buildPoll(q(7), 1, new Date(Date.UTC(2026, 9, 23 + d, 6)));
    positions.add(poll.correct_option_id);
  }
  assert.equal(positions.size, 3);
});

test("верный ответ не повторяет позицию предыдущей викторины", () => {
  const now = new Date("2026-10-23T06:00:00Z");
  for (let avoid = 0; avoid < 3; avoid++) {
    for (let i = 0; i < 200; i++) {
      const poll = buildPoll(q(i + 1), 1, now, Math.random, avoid);
      assert.notEqual(poll.correct_option_id, avoid);
      assert.equal(poll.options[poll.correct_option_id], "Второй");
      assert.equal(poll.options.length, 3);
    }
  }
});

test("«Все перечисленное» остаётся последним и при избегании позиции", () => {
  const x = q(9, {
    answers: [
      { text: "А", isCorrect: false },
      { text: "Б", isCorrect: true },
      { text: "В", isCorrect: false },
      { text: "Все перечисленное.", isCorrect: false },
    ],
  });
  for (let i = 0; i < 100; i++) {
    const poll = buildPoll(x, 1, new Date(), Math.random, 1);
    assert.equal(poll.options.at(-1), "Все перечисленное.");
    assert.equal(poll.options[poll.correct_option_id], "Б");
    assert.notEqual(poll.correct_option_id, 1);
  }
});

test("если верный вариант закреплён в конце, избегание позиции его не двигает", () => {
  const x = q(9, {
    answers: [
      { text: "А", isCorrect: false },
      { text: "Б", isCorrect: false },
      { text: "Все перечисленное.", isCorrect: true },
    ],
  });
  const poll = buildPoll(x, 1, new Date(), Math.random, 2);
  assert.equal(poll.correct_option_id, 2);
});

test("при случайном /question позиция верного ответа разная и не повторяет прошлую", () => {
  const now = new Date("2026-10-23T06:00:00Z");
  const positions = new Set();
  let last = null;
  for (let i = 0; i < 100; i++) {
    const poll = buildPoll(q((i % 30) + 1), 1, now, Math.random, last);
    if (last !== null) assert.notEqual(poll.correct_option_id, last);
    positions.add(poll.correct_option_id);
    last = poll.correct_option_id;
  }
  assert.equal(positions.size, 3);
});
