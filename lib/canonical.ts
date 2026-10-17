/**
 * Дубли вопросов между областями: один и тот же вопрос с теми же верными ответами встречается в нескольких областях,
 * и у каждого есть своя страница. Главной считаем страницу в области, чей код идёт первым по «естественному» порядку
 * (А.1 раньше Б.1.1, Б.1.2 раньше Б.1.10; sortOrder не используем, он ничего не гарантирует), затем с меньшим номером;
 * а остальные ссылаются на неё через rel=canonical и не попадают в sitemap. Сами вопросы остаются в своих областях.
 */
export type DupItem = {
  id: number;
  areaSlug: string;
  areaCode: string;
  number: number;
  slug: string;
  text: string;
  correct: string[];
};

export type CanonicalTarget = { areaSlug: string; slug: string };

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'.,;:?!()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function duplicateKey(item: Pick<DupItem, "text" | "correct">): string {
  return `${norm(item.text)}||${item.correct.map(norm).sort().join("|")}`;
}

/** id неглавных копий → адрес главной страницы. Главные страницы в карту не попадают. */
export function pickCanonicals(items: DupItem[]): Map<number, CanonicalTarget> {
  const groups = new Map<string, DupItem[]>();
  for (const it of items) {
    const key = duplicateKey(it);
    const g = groups.get(key);
    if (g) g.push(it);
    else groups.set(key, [it]);
  }
  const out = new Map<number, CanonicalTarget>();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const [main, ...rest] = [...g].sort(
      (a, b) => a.areaCode.localeCompare(b.areaCode, "ru", { numeric: true }) || a.number - b.number,
    );
    for (const it of rest) out.set(it.id, { areaSlug: main!.areaSlug, slug: main!.slug });
  }
  return out;
}
