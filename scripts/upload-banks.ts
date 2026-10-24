/**
 * Загрузка папки банков (по файлу на область, имя файла — slug) на сайт через POST /api/admin/import.
 *   IMPORT_TOKEN=… npx tsx scripts/upload-banks.ts --dir data/raw/prombez24 [--site https://prombez-game.ru]
 *       [--dry-run] [--publish official|all] [--only a1,b1-1]
 *
 * --dry-run   импорт с откатом: отчёт, сколько вопросов узнано по тексту, добавится и уйдёт; ничего не пишется.
 * --publish   official — открыть области с официальным банком (area.authority задан), all — все. Без флага
 *             новые области остаются скрытыми, а у существующих публикация не меняется.
 */
import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    dir: { type: "string" },
    site: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    publish: { type: "string" },
    only: { type: "string" },
  },
});

type Report = {
  added: number;
  updated: number;
  unchanged: number;
  reactivated: number;
  deactivated: number;
  matchedBySource: number;
  matchedByText: number;
};

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function main() {
  const dir = values.dir ?? fail("Укажите --dir с JSON-файлами областей");
  const token = process.env.IMPORT_TOKEN ?? fail("Нужна переменная IMPORT_TOKEN");
  const site = (values.site ?? process.env.REVALIDATE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (!site) fail("Укажите --site");
  const publish = values.publish;
  if (publish && publish !== "official" && publish !== "all") fail("--publish: official или all");
  const only = values.only ? new Set(values.only.split(",").map((s) => s.trim())) : null;
  const dryRun = values["dry-run"] ?? false;

  const files = (await readdir(dir)).filter((f) => /^[a-z0-9-]+\.json$/.test(f)).sort();
  let failed = 0;
  const sum: Report = {
    added: 0,
    updated: 0,
    unchanged: 0,
    reactivated: 0,
    deactivated: 0,
    matchedBySource: 0,
    matchedByText: 0,
  };
  console.log("slug\tкод\tвопросов\tпо id\tпо тексту\tдобавлено\tобновлено\tдеактивировано\tопубликовать");
  for (const file of files) {
    const slug = file.replace(/\.json$/, "");
    if (only && !only.has(slug)) continue;
    const body = await readFile(path.join(dir, file), "utf8");
    const area = (JSON.parse(body) as { area: { code: string; authority?: string | null } }).area;
    const pub = publish === "all" || (publish === "official" && !!area.authority);
    const url = new URL("/api/admin/import", site);
    url.searchParams.set("area", slug);
    if (dryRun) url.searchParams.set("dryRun", "1");
    if (pub) url.searchParams.set("publish", "1");
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as { report?: Report; questions?: number; error?: string };
    if (!res.ok || !json.report) {
      failed++;
      console.log(`${slug}\t${area.code}\tОШИБКА HTTP ${res.status} ${JSON.stringify(json).slice(0, 500)}`);
      continue;
    }
    const r = json.report;
    for (const k of Object.keys(sum) as (keyof Report)[]) sum[k] += r[k];
    console.log(
      [
        slug,
        area.code,
        json.questions,
        r.matchedBySource,
        r.matchedByText,
        r.added,
        r.updated,
        r.deactivated,
        pub ? "да" : "",
      ].join("\t"),
    );
  }
  console.log(
    `Итого${dryRun ? " (пробный прогон, ничего не записано)" : ""}: узнано по id ${sum.matchedBySource}, по тексту ${sum.matchedByText}, добавлено ${sum.added}, обновлено ${sum.updated}, деактивировано ${sum.deactivated}, ошибок ${failed}`,
  );
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
