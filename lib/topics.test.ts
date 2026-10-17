import { describe, expect, it } from "vitest";
import { MIN_TOPIC_QUESTIONS, getTopic, summarizeTopics, topicsFor } from "./topics";

describe("topicsFor", () => {
  it("находит тему по ключевым словам с любым окончанием", () => {
    const slugs = topicsFor("Где хранятся оригиналы декларации промышленной безопасности?").map((t) => t.slug);
    expect(slugs).toContain("deklaratsiya");
  });

  it("не зависит от регистра и допускает несколько тем", () => {
    const slugs = topicsFor("Кем осуществляется Производственный контроль и расследование аварий?").map((t) => t.slug);
    expect(slugs).toEqual(expect.arrayContaining(["proizvodstvennyy-kontrol", "avarii"]));
  });

  it("возвращает пустой список, если ключевых слов нет", () => {
    expect(topicsFor("Что такое мишень?")).toEqual([]);
  });
});

describe("summarizeTopics", () => {
  it("отбрасывает темы с малым числом вопросов", () => {
    const few = Array.from({ length: MIN_TOPIC_QUESTIONS - 1 }, () => ({ text: "Декларация" }));
    expect(summarizeTopics(few)).toEqual([]);
  });

  it("считает вопросы и сохраняет порядок тем", () => {
    const items = [
      ...Array.from({ length: MIN_TOPIC_QUESTIONS }, () => ({ text: "Про лицензирование" })),
      ...Array.from({ length: MIN_TOPIC_QUESTIONS + 2 }, () => ({ text: "Про декларацию" })),
    ];
    expect(summarizeTopics(items)).toEqual([
      { slug: "deklaratsiya", title: "Декларация промышленной безопасности", count: MIN_TOPIC_QUESTIONS + 2 },
      { slug: "litsenzirovanie", title: "Лицензирование", count: MIN_TOPIC_QUESTIONS },
    ]);
  });
});

describe("getTopic", () => {
  it("ищет по slug", () => {
    expect(getTopic("avarii")?.title).toContain("Аварии");
    expect(getTopic("net-takoy")).toBeUndefined();
  });
});
