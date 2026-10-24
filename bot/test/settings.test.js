import { test } from "node:test";
import assert from "node:assert/strict";
import { AREAS, COURSES } from "../tgcloud/lib/catalog.js";
import {
  DEFAULT_AREAS,
  PAGE_SIZE,
  applyCallback,
  courseMenu,
  describeSelection,
  mainMenu,
  selectedAreas,
} from "../tgcloud/lib/settings.js";

const buttons = (menu) => menu.reply_markup.inline_keyboard.flat();
const prombez = AREAS.filter((a) => a.course === "prombez");

test("каталог: у каждой области есть сфера, slug уникальны", () => {
  const courses = new Set(COURSES.map((c) => c.slug));
  assert.ok(AREAS.length > 0);
  for (const a of AREAS) assert.ok(courses.has(a.course), a.slug);
  assert.equal(new Set(AREAS.map((a) => a.slug)).size, AREAS.length);
});

test("без настроек — А.1, неизвестные области отбрасываются", () => {
  assert.deepEqual(selectedAreas(null), DEFAULT_AREAS);
  assert.deepEqual(selectedAreas(["a1", "нет-такой"]), ["a1"]);
  assert.deepEqual(selectedAreas([]), []);
});

test("callback_data укладываются в 64 байта", () => {
  const all = [mainMenu(["a1"]), ...COURSES.flatMap((c) => [courseMenu([], c.slug, 0), courseMenu([], c.slug, 999)])];
  for (const m of all) for (const b of buttons(m)) assert.ok(Buffer.byteLength(b.callback_data) <= 64, b.callback_data);
});

test("область включается и выключается кнопкой", () => {
  const b = prombez[1];
  const on = applyCallback(["a1"], `t:${b.slug}:0`);
  assert.deepEqual(on.list, ["a1", b.slug]);
  assert.deepEqual(on.view, { menu: "course", course: "prombez", page: 0 });
  assert.deepEqual(applyCallback(on.list, `t:${b.slug}:0`).list, ["a1"]);
});

test("выбрать все и снять все в сфере", () => {
  const all = applyCallback(["a1"], "all:elektro:1:0").list;
  assert.equal(all.length, 1 + AREAS.filter((a) => a.course === "elektro").length);
  assert.deepEqual(applyCallback(all, "all:elektro:0:0").list, ["a1"]);
  assert.deepEqual(applyCallback(all, "all:prombez:0:0").list.includes("a1"), false);
});

test("меню сферы листается по страницам", () => {
  const pages = Math.ceil(prombez.length / PAGE_SIZE);
  const m = courseMenu([], "prombez", 1);
  const areaButtons = buttons(m).filter((b) => b.callback_data.startsWith("t:"));
  assert.equal(areaButtons.length, Math.min(PAGE_SIZE, prombez.length - PAGE_SIZE));
  assert.ok(buttons(m).some((b) => b.text === `2 / ${pages}`));
  // Последняя страница → «›» ведёт на первую.
  const last = courseMenu([], "prombez", pages - 1);
  assert.ok(buttons(last).some((b) => b.callback_data === "c:prombez:0"));
});

test("главное меню показывает число выбранных областей в сфере", () => {
  const m = mainMenu(["a1"]);
  const p = buttons(m).find((b) => b.callback_data === "c:prombez:0");
  assert.match(p.text, new RegExp(`^🔹 Промышленная безопасность · 1/${prombez.length}$`));
});

test("описание выбора", () => {
  assert.equal(describeSelection(["a1"]), "А.1");
  assert.equal(describeSelection([]), "ничего не выбрано");
  const elektro = AREAS.filter((a) => a.course === "elektro").map((a) => a.slug);
  assert.match(describeSelection(elektro), /^Электробезопасность \(все \d+\)$/);
});
