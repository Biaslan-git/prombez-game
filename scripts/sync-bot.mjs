/**
 * Синхронизация бота «Вопрос дня» с сайтом. Бот работает на Telegram Serverless (bot/) и хранит вопросы у себя
 * в базе, чтобы не зависеть от доступности сайта.
 *
 *   node scripts/sync-bot.mjs fetch [--site https://prombez-game.ru] [--wait 1200]
 *     Скачивает сферы и области (GET /api/telegram/areas) и вопросы каждой области (GET /api/telegram/questions?area=…),
 *     пишет каталог меню /settings в bot/tgcloud/lib/catalog.js и вопросы в bot/.cache/questions.json.
 *     --wait N — ждать до N секунд, пока сайт не начнёт отдавать /api/telegram/areas (сразу после деплоя).
 *   TGCLOUD_TOKEN=… node scripts/sync-bot.mjs import
 *     Загружает bot/.cache/questions.json в базу бота порциями (endpoints/importQuestions) и удаляет вопросы,
 *     которых больше нет. Перед этим код бота с новым каталогом должен быть выложен: cd bot && npx tgcloud push.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const BOT = new URL("../bot/", import.meta.url);
const CACHE = new URL(".cache/questions.json", BOT);
const CATALOG = new URL("tgcloud/lib/catalog.js", BOT);

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { site: { type: "string" }, wait: { type: "string" } },
});
const site = (values.site || process.env.NEXT_PUBLIC_SITE_URL || "https://prombez-game.ru").replace(/\/$/, "");

async function getJson(path) {
  const res = await fetch(`${site}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} от ${site}${path}`);
  return res.json();
}

async function waitForAreas(seconds) {
  const until = Date.now() + seconds * 1000;
  for (;;) {
    try {
      return await getJson("/api/telegram/areas");
    } catch (e) {
      if (Date.now() > until) throw e;
      console.log(`Сайт ещё не отдаёт /api/telegram/areas (${e.message}), ждём…`);
      await new Promise((r) => setTimeout(r, 30_000));
    }
  }
}

async function fetchAll() {
  const { courses, areas } = await waitForAreas(Number(values.wait) || 0);
  const all = [];
  const counts = new Map();
  for (const a of areas) {
    const res = await getJson(`/api/telegram/questions?area=${encodeURIComponent(a.slug)}`);
    if (res.area !== a.slug) throw new Error(`Сайт вернул вопросы области ${res.area} вместо ${a.slug}`);
    counts.set(a.slug, res.questions.length);
    all.push(...res.questions);
  }
  const withQuestions = areas.filter((a) => counts.get(a.slug) > 0);
  const usedCourses = courses.filter((c) => withQuestions.some((a) => a.course === c.slug));
  if (!all.length) throw new Error("Сайт не вернул ни одного вопроса");

  const line = (x) => "  " + JSON.stringify(x);
  const catalog =
    `// Файл создан scripts/sync-bot.mjs (${withQuestions.length} областей, ${all.length} вопросов). Не править вручную.\n` +
    `// Сферы и области для меню /settings; n — сколько вопросов области загружено в бота.\n` +
    `export const COURSES = [\n${usedCourses.map(line).join(",\n")},\n];\n\n` +
    `export const AREAS = [\n${withQuestions
      .map((a) => line({ slug: a.slug, code: a.code, title: a.title, course: a.course, n: counts.get(a.slug) }))
      .join(",\n")},\n];\n`;
  await writeFile(CATALOG, catalog);
  await mkdir(new URL(".cache/", BOT), { recursive: true });
  await writeFile(CACHE, JSON.stringify(all));
  console.log(`Каталог: ${usedCourses.length} сфер, ${withQuestions.length} областей; вопросов ${all.length}`);
  const empty = areas.length - withQuestions.length;
  if (empty) console.log(`Без подходящих для опроса вопросов: ${empty} областей (в меню их не будет)`);
}

/** Модули бота для `run`: сервер собирает импорты только из присланных исходников (как делает `tgcloud run`). */
async function botSources() {
  const root = new URL("tgcloud/", BOT);
  const out = {};
  async function walk(dir, prefix) {
    for (const e of await readdir(new URL(dir, root), { withFileTypes: true })) {
      const rel = prefix + e.name;
      if (e.isDirectory()) await walk(`${dir}${e.name}/`, `${rel}/`);
      else if (e.name.endsWith(".js")) out[rel.slice(0, -3)] = await readFile(new URL(rel, root), "utf8");
    }
  }
  await walk("", "");
  return out;
}

async function importAll() {
  const token = process.env.TGCLOUD_TOKEN;
  if (!token) throw new Error("Нужна переменная TGCLOUD_TOKEN");
  const { runFunction } = await import(new URL("node_modules/@tgcloud/cli/src/api/endpoints.js", BOT));
  const sources = await botSources();
  const ctx = { initData: { user: { id: 0 } } };
  const call = async (args) => (await runFunction(token, "endpoints/importQuestions", sources, args, ctx)).result;

  const list = JSON.parse(await readFile(CACHE, "utf8"));
  const gen = Math.floor(Date.now() / 1000);
  let batch = 500;
  let done = 0;
  while (done < list.length) {
    const part = list.slice(done, done + batch);
    try {
      await call({ gen, questions: part });
    } catch (e) {
      // Слишком большой запрос или долгая обработка: делим порцию.
      if (batch > 25 && (e.status === 413 || e.status >= 500 || /too large|timeout|limit/i.test(e.message))) {
        batch = Math.floor(batch / 2);
        console.log(`Ошибка «${e.message}», порция уменьшена до ${batch}`);
        continue;
      }
      throw e;
    }
    done += part.length;
    if (done === list.length || (done / batch) % 20 === 0) console.log(`Загружено ${done} из ${list.length}`);
  }
  const res = await call({ gen, finish: true });
  console.log(`Готово: в боте ${res.total} вопросов, удалено старых ${res.removed}`);
}

const cmd = positionals[0];
if (cmd === "fetch") await fetchAll();
else if (cmd === "import") await importAll();
else {
  console.error("Использование: node scripts/sync-bot.mjs fetch|import");
  process.exit(1);
}
