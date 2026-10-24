/**
 * Отправка адресов сайта в IndexNow (Яндекс, Bing): быстрее узнают о новых и изменённых страницах.
 *   npx tsx scripts/indexnow.ts [--site https://prombez-game.ru] [--dry-run]
 * Ключ — это имя файла в public/*.txt (его содержимое совпадает с именем), он публичный по протоколу.
 */
import { readdir, readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { site: { type: "string" }, "dry-run": { type: "boolean", default: false } },
});
const site = (values.site ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://prombez-game.ru").replace(/\/$/, "");

async function findKey(): Promise<string> {
  for (const f of await readdir("public")) {
    const m = /^([0-9a-f]{32})\.txt$/.exec(f);
    if (m && (await readFile(`public/${f}`, "utf8")).trim() === m[1]) return m[1]!;
  }
  throw new Error("В public/ нет файла-ключа IndexNow (<32 hex>.txt)");
}

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
// Протокол принимает до 10 000 адресов за запрос.
const BATCH = 10_000;

/** Адреса из sitemap; индекс (sitemapindex) раскрывается в адреса его частей. */
async function sitemapUrls(url: string): Promise<string[]> {
  const xml = await (await fetch(url)).text();
  if (!xml.includes("<sitemapindex")) return locs(xml);
  return (await Promise.all(locs(xml).map(sitemapUrls))).flat();
}

async function main() {
  const key = await findKey();
  const urls = await sitemapUrls(`${site}/sitemap.xml`);
  if (urls.length === 0) throw new Error("В sitemap нет адресов");
  console.log(`Адресов в sitemap: ${urls.length}`);
  if (values["dry-run"]) return;

  for (let i = 0; i < urls.length; i += BATCH) {
    const urlList = urls.slice(i, i + BATCH);
    const res = await fetch("https://yandex.com/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: new URL(site).host, key, keyLocation: `${site}/${key}.txt`, urlList }),
    });
    console.log(`IndexNow ${i + 1}–${i + urlList.length}: HTTP ${res.status} ${await res.text()}`);
    if (!res.ok && res.status !== 202) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
