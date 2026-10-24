/**
 * Сопоставление вопросов новой версии банка с тем, что уже лежит в БД. Чистые функции, чтобы покрыть тестами.
 */

const TAIL_RE = /(?:\s*выберите\s+(?:\S+\s+){0,3}(?:вариант|ответ)\S*(?:\s+ответ\S*)?\s*[.:]?)+\s*$/i;

/**
 * Ключ для сравнения формулировок: регистр, ё/е, пунктуация, кавычки и пробелы не важны, хвост
 * «Выберите правильный вариант ответа» отбрасывается. Вопросы с картинкой совпадают, только если совпала и картинка.
 */
export function matchKey(text: string, imageHash: string | null): string {
  const t = text
    .replace(TAIL_RE, "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return imageHash ? `${t}#${imageHash}` : t;
}

export type ExistingRow = { id: number; number: number; sourceId: number | null; key: string };
export type IncomingRow = { number: number; sourceId: number | null; key: string };

export type NumberPlan = {
  /** Для каждого входящего вопроса (в том же порядке): номер в области и id существующей строки, если она найдена. */
  items: { number: number; prevId: number | null }[];
  /** id существующих строк, которым нашлась пара; остальные деактивируются. */
  claimed: Set<number>;
  matchedBySource: number;
  matchedByText: number;
};

export function planNumbers(existing: readonly ExistingRow[], incoming: readonly IncomingRow[]): NumberPlan {
  const bySourceMode = incoming.length > 0 && incoming.every((q) => q.sourceId !== null);
  if (!bySourceMode) {
    const byNumber = new Map(existing.map((r) => [r.number, r]));
    const items = incoming.map((q) => ({ number: q.number, prevId: byNumber.get(q.number)?.id ?? null }));
    return {
      items,
      claimed: new Set(items.flatMap((i) => (i.prevId === null ? [] : [i.prevId]))),
      matchedBySource: 0,
      matchedByText: 0,
    };
  }

  const incomingSources = new Set(incoming.map((q) => q.sourceId!));
  const bySource = new Map<number, ExistingRow>();
  // По тексту можно узнать только строку, чей source_id не пришёл в этой версии (или которой его ещё не присваивали).
  const byKey = new Map<string, ExistingRow[]>();
  for (const r of existing) {
    if (r.sourceId !== null) bySource.set(r.sourceId, r);
    if (r.sourceId === null || !incomingSources.has(r.sourceId)) {
      const list = byKey.get(r.key) ?? [];
      list.push(r);
      byKey.set(r.key, list);
    }
  }
  for (const list of byKey.values()) list.sort((x, y) => x.number - y.number);

  const claimed = new Set<number>();
  let matchedBySource = 0;
  let matchedByText = 0;
  const found: (ExistingRow | null)[] = incoming.map((q) => {
    const s = bySource.get(q.sourceId!);
    if (s && !claimed.has(s.id)) {
      claimed.add(s.id);
      matchedBySource++;
      return s;
    }
    return null;
  });
  incoming.forEach((q, i) => {
    if (found[i]) return;
    const t = byKey.get(q.key)?.find((r) => !claimed.has(r.id));
    if (t) {
      claimed.add(t.id);
      matchedByText++;
      found[i] = t;
    }
  });

  // В новой области номер — место в банке. В существующей новые вопросы идут в конец: номера заняты всеми её
  // строками, и неактивными тоже (уникальный индекс area_id + number).
  let next = Math.max(0, ...existing.map((r) => r.number)) + 1;
  const items = incoming.map((q, i) => {
    const prev = found[i];
    if (prev) return { number: prev.number, prevId: prev.id };
    return { number: existing.length ? next++ : q.number, prevId: null };
  });
  return { items, claimed, matchedBySource, matchedByText };
}
