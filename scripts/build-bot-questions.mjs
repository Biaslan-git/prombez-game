/**
 * Обновляет bot/tgcloud/lib/questions.js: вопросы для «вопроса дня» зашиваются в код бота (Telegram Serverless),
 * чтобы бот не зависел от доступности сайта. Источник — GET /api/telegram/questions.
 *   node scripts/build-bot-questions.mjs [--site https://prombez-game.ru]
 * После обновления: cd bot && npx tgcloud push (с TGCLOUD_TOKEN).
 */
import { writeFile } from "node:fs/promises";

const argSite = process.argv.indexOf("--site");
const site = (
  argSite > 0 ? process.argv[argSite + 1] : process.env.NEXT_PUBLIC_SITE_URL || "https://prombez-game.ru"
).replace(/\/$/, "");

const res = await fetch(`${site}/api/telegram/questions`);
if (!res.ok) throw new Error(`HTTP ${res.status} от ${site}/api/telegram/questions`);
const { area, questions } = await res.json();
if (!Array.isArray(questions) || questions.length === 0) throw new Error("Список вопросов пуст");

const lines = questions.map((q) => "  " + JSON.stringify(q)).join(",\n");
const out = `// Файл создан scripts/build-bot-questions.mjs (область ${area}, ${questions.length} вопросов). Не править вручную.\nexport const QUESTIONS = [\n${lines},\n];\n`;
await writeFile(new URL("../bot/tgcloud/lib/questions.js", import.meta.url), out);
console.log(`Записано ${questions.length} вопросов области ${area} (${(out.length / 1024).toFixed(0)} КБ)`);
