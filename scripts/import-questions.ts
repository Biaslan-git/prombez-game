/**
 * Импорт банка вопросов области.
 *   npx tsx scripts/import-questions.ts --area a1 --file data/raw/a1.json --version "2026-xx" [--publish] [--dry-run]
 *
 * Upsert по (area_id, number). Вопросы, которых нет в новой версии, деактивируются (не удаляются).
 * Slug существующего вопроса не меняется, даже если изменился текст.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { closeDb, getDb } from "../lib/db/client";
import { runImport } from "../lib/import-db";
import { parseImportFile } from "../lib/import";

const { values } = parseArgs({
  options: {
    area: { type: "string" },
    file: { type: "string" },
    version: { type: "string" },
    publish: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function main() {
  const slug = values.area?.trim().toLowerCase();
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) fail("Укажите --area, например --area a1 (латиница и цифры)");
  if (!values.file) fail("Укажите --file с JSON-банком вопросов");

  const parsed = parseImportFile(JSON.parse(await readFile(values.file, "utf8")));
  if (parsed.errors.length) {
    console.error(`Файл не прошёл проверку (${parsed.errors.length} ошибок):`);
    for (const e of parsed.errors) console.error("  - " + e);
    process.exit(1);
  }
  const { area: a, questions: incoming } = parsed;
  const bankVersion = values.version ?? a.bank_version ?? "";

  if (values["dry-run"]) {
    console.log(`Проверка пройдена: область ${a.code}, вопросов ${incoming.length}. В БД ничего не записано.`);
    return;
  }

  const db = getDb();
  const report = await runImport(db, parsed, { slug, version: bankVersion, publish: values.publish ?? false });

  console.log(`Область ${a.code} (${slug}), версия банка «${bankVersion}»`);
  console.log(`  добавлено:       ${report.added}`);
  console.log(`  обновлено:       ${report.updated}`);
  console.log(`  без изменений:   ${report.unchanged}`);
  console.log(`  возвращено:      ${report.reactivated}`);
  console.log(`  деактивировано:  ${report.deactivated}`);

  await revalidate();
}

// Сброс ISR-кэша на работающем сайте, если заданы адрес и секрет.
async function revalidate() {
  const site = process.env.REVALIDATE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!site || !secret) return;
  try {
    const res = await fetch(new URL("/api/revalidate", site), {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    console.log(res.ok ? "Кэш страниц сброшен" : `Сброс кэша не удался: HTTP ${res.status}`);
  } catch (err) {
    console.log(`Сброс кэша не удался: ${(err as Error).message}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
