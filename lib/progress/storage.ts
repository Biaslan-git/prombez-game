import { emptyAreaProgress, type AreaProgress, type Box, type QuestionProgress } from "./types";

/**
 * Хранилище прогресса. UI работает только через этот интерфейс,
 * чтобы позже подменить localStorage на серверную реализацию (аккаунты).
 */
export interface ProgressStore {
  load(areaSlug: string): AreaProgress;
  save(areaSlug: string, progress: AreaProgress): void;
}

export const progressKey = (areaSlug: string) => `pg:v1:progress:${areaSlug}`;

type KV = Pick<Storage, "getItem" | "setItem">;

export function createKVStore(getStorage: () => KV | null | undefined): ProgressStore {
  return {
    load(areaSlug) {
      try {
        const raw = getStorage()?.getItem(progressKey(areaSlug));
        return raw ? parseAreaProgress(JSON.parse(raw)) : emptyAreaProgress();
      } catch {
        return emptyAreaProgress();
      }
    },
    save(areaSlug, progress) {
      try {
        getStorage()?.setItem(progressKey(areaSlug), JSON.stringify(progress));
      } catch {
        // Приватный режим, переполнение квоты — прогресс просто не сохранится.
      }
    },
  };
}

export const localProgressStore: ProgressStore = createKVStore(() =>
  typeof window === "undefined" ? null : window.localStorage,
);

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseQuestion(v: unknown): QuestionProgress | null {
  if (!v || typeof v !== "object") return null;
  const q = v as Record<string, unknown>;
  if (!isNum(q.box) || q.box < 0 || q.box > 5 || !isNum(q.nextReviewAt)) return null;
  return {
    box: Math.round(q.box) as Box,
    attempts: isNum(q.attempts) ? q.attempts : 0,
    wrong: isNum(q.wrong) ? q.wrong : 0,
    lastAnsweredAt: isNum(q.lastAnsweredAt) ? q.lastAnsweredAt : 0,
    nextReviewAt: q.nextReviewAt,
    lastResults: Array.isArray(q.lastResults) ? q.lastResults.filter((x) => typeof x === "boolean").slice(-3) : [],
  };
}

/** Мягкий разбор сохранённых данных: битые записи отбрасываются, остальное сохраняется. */
export function parseAreaProgress(v: unknown): AreaProgress {
  const base = emptyAreaProgress();
  if (!v || typeof v !== "object" || (v as { version?: unknown }).version !== 1) return base;
  const o = v as Record<string, unknown>;

  if (o.questions && typeof o.questions === "object") {
    for (const [k, qv] of Object.entries(o.questions as Record<string, unknown>)) {
      const id = Number(k);
      const q = parseQuestion(qv);
      if (Number.isInteger(id) && q) base.questions[id] = q;
    }
  }
  if (Array.isArray(o.exams)) {
    base.exams = o.exams
      .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
      .filter((e) => isNum(e.at) && isNum(e.correct) && isNum(e.total))
      .map((e) => ({
        at: e.at as number,
        correct: e.correct as number,
        total: e.total as number,
        passed: e.passed === true,
      }));
  }
  const s = o.streak as Record<string, unknown> | undefined;
  if (s && typeof s.lastDay === "string" && isNum(s.days)) base.streak = { lastDay: s.lastDay, days: s.days };
  const d = o.daily as Record<string, unknown> | undefined;
  if (d && typeof d.day === "string" && isNum(d.count)) base.daily = { day: d.day, count: d.count };
  return base;
}
