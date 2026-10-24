// Выбор сфер и областей для вопроса дня (/settings): чистые функции, меню — inline-клавиатуры Telegram.
import { AREAS, COURSES } from "./catalog.js";

/** Области по умолчанию: подписчики до появления настроек получали вопросы А.1. */
export const DEFAULT_AREAS = ["a1"];
/** Областей на странице меню сферы. */
export const PAGE_SIZE = 8;

const BY_SLUG = new Map(AREAS.map((a) => [a.slug, a]));

/** Выбранные области подписчика (только те, что есть в каталоге), в порядке каталога. */
export function selectedAreas(stored, areas = AREAS) {
  const list = Array.isArray(stored) ? stored : DEFAULT_AREAS;
  const set = new Set(list);
  return areas.filter((a) => set.has(a.slug)).map((a) => a.slug);
}

export function toggleArea(list, slug) {
  if (!BY_SLUG.has(slug)) return list;
  return list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
}

/** Включить (on) или выключить все области сферы. */
export function setCourse(list, course, on) {
  const slugs = AREAS.filter((a) => a.course === course).map((a) => a.slug);
  const rest = list.filter((s) => !slugs.includes(s));
  return on ? [...rest, ...slugs] : rest;
}

function cut(s, max) {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

/** Кратко, что выбрано: «А.1, Б.1.1» или «Промышленная безопасность целиком и ещё 3 области». */
export function describeSelection(list) {
  if (!list.length) return "ничего не выбрано";
  const set = new Set(list);
  const parts = [];
  let rest = 0;
  for (const c of COURSES) {
    const areas = AREAS.filter((a) => a.course === c.slug);
    const chosen = areas.filter((a) => set.has(a.slug));
    if (!chosen.length) continue;
    if (chosen.length === areas.length && areas.length > 1) parts.push(`${c.title} (все ${areas.length})`);
    else if (chosen.length <= 3) parts.push(...chosen.map((a) => a.code));
    else rest += chosen.length;
  }
  if (rest) parts.push(`ещё ${rest} ${plural(rest, "область", "области", "областей")}`);
  return parts.join(", ");
}

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const mark = (chosen, total) => (chosen === 0 ? "▫️" : chosen === total ? "✅" : "🔹");

/** Главное меню: сферы с числом выбранных областей. */
export function mainMenu(list) {
  const set = new Set(list);
  const rows = COURSES.map((c) => {
    const areas = AREAS.filter((a) => a.course === c.slug);
    const chosen = areas.filter((a) => set.has(a.slug)).length;
    return [
      { text: `${mark(chosen, areas.length)} ${c.title} · ${chosen}/${areas.length}`, callback_data: `c:${c.slug}:0` },
    ];
  });
  rows.push([{ text: "Готово", callback_data: "x" }]);
  return {
    text:
      "Какие вопросы присылать?\n\n" +
      `Сейчас: ${describeSelection(list)}.\n\n` +
      "Откройте сферу и отметьте области. Вопрос дня выбирается из всех отмеченных.",
    reply_markup: { inline_keyboard: rows },
  };
}

/** Меню сферы: области постранично, «выбрать все» и «снять все». */
export function courseMenu(list, course, page = 0) {
  const c = COURSES.find((x) => x.slug === course);
  if (!c) return mainMenu(list);
  const set = new Set(list);
  const areas = AREAS.filter((a) => a.course === course);
  const pages = Math.max(1, Math.ceil(areas.length / PAGE_SIZE));
  const p = Math.min(Math.max(0, page), pages - 1);
  const chosen = areas.filter((a) => set.has(a.slug)).length;
  const rows = [];
  if (areas.length > 1)
    rows.push([
      { text: "Выбрать все", callback_data: `all:${course}:1:${p}` },
      { text: "Снять все", callback_data: `all:${course}:0:${p}` },
    ]);
  for (const a of areas.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE)) {
    rows.push([
      { text: cut(`${set.has(a.slug) ? "✅" : "▫️"} ${a.code} ${a.title}`, 64), callback_data: `t:${a.slug}:${p}` },
    ]);
  }
  if (pages > 1)
    rows.push([
      { text: "‹", callback_data: `c:${course}:${(p - 1 + pages) % pages}` },
      { text: `${p + 1} / ${pages}`, callback_data: "noop" },
      { text: "›", callback_data: `c:${course}:${(p + 1) % pages}` },
    ]);
  rows.push([{ text: "« Все сферы", callback_data: "m" }]);
  return {
    text: `${c.title}\n\nВыбрано ${chosen} из ${areas.length}. Нажмите на область, чтобы включить или выключить её.`,
    reply_markup: { inline_keyboard: rows },
  };
}

/**
 * Разбор callback_data кнопок меню. Возвращает { list, view }: новый выбор и что показать
 * (view: { menu: "main" } | { menu: "course", course, page } | { menu: "done" } | null — ничего не менять).
 */
export function applyCallback(list, data) {
  const [kind, a, b, c] = String(data ?? "").split(":");
  switch (kind) {
    case "m":
    case "open":
      return { list, view: { menu: "main" } };
    case "c":
      return { list, view: { menu: "course", course: a, page: Number(b) || 0 } };
    case "t": {
      const area = BY_SLUG.get(a);
      if (!area) return { list, view: { menu: "main" } };
      return { list: toggleArea(list, a), view: { menu: "course", course: area.course, page: Number(b) || 0 } };
    }
    case "all":
      return { list: setCourse(list, a, b === "1"), view: { menu: "course", course: a, page: Number(c) || 0 } };
    case "x":
      return { list, view: { menu: "done" } };
    default:
      return { list, view: null };
  }
}

/** Область по slug (для /start a_<slug> с сайта). */
export const findArea = (slug) => BY_SLUG.get(slug) ?? null;
