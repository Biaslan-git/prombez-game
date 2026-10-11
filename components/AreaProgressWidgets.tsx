"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ReadinessBar } from "@/components/Readiness";
import { useAreaProgress } from "@/components/useAreaProgress";
import {
  STREAK_DAILY_MIN,
  answersToday,
  approxReadiness,
  areaStats,
  currentStreak,
  localProgressStore,
  readinessLabel,
} from "@/lib/progress";

/** Готовность на карточке области (главная). Показывается, только если есть прогресс. */
export function AreaCardReadiness({ slug, total }: { slug: string; total: number }) {
  const [pct, setPct] = useState<number | null>(null);
  useEffect(() => {
    const p = localProgressStore.load(slug);
    if (Object.keys(p.questions).length > 0) setPct(approxReadiness(p, total));
  }, [slug, total]);
  if (pct === null) return null;
  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-muted">{readinessLabel(pct)}</span>
        <b className="tabular-nums">{pct}%</b>
      </div>
      <ReadinessBar value={pct} compact />
    </div>
  );
}

/** Блок прогресса на странице области: готовность, серия, кнопки, статистика. */
export function AreaDashboard({ slug, activeIds }: { slug: string; activeIds: number[] }) {
  const { progress } = useAreaProgress(slug);
  const stats = progress ? areaStats(progress, activeIds) : null;
  const now = Date.now();
  const streak = progress ? currentStreak(progress, now) : 0;
  const today = progress ? answersToday(progress, now) : 0;
  const lastExam = progress?.exams[progress.exams.length - 1];

  return (
    <section aria-label="Ваш прогресс" className="rounded-2xl border border-line bg-surface p-5">
      <ReadinessBar value={stats?.readiness ?? null} />
      <p className="mt-3 text-sm text-muted">
        {streak > 0 ? (
          <>
            🔥 Серия: <b className="text-fg">{streak}</b> дн.
          </>
        ) : (
          "🔥 Серия дней: ответьте на 10 вопросов, чтобы начать"
        )}
        {progress && today > 0 && today < STREAK_DAILY_MIN && ` · сегодня ${today} из ${STREAK_DAILY_MIN}`}
      </p>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
        <Link href={`/${slug}/train`} className="btn-primary sm:col-span-3">
          Тренировка
        </Link>
        <Link href={`/${slug}/exam`} className="btn-secondary sm:col-span-1">
          Экзамен
        </Link>
        <Link href={`/${slug}/mistakes`} className="btn-secondary sm:col-span-2">
          Ошибки{stats ? ` (${stats.mistakes})` : ""}
        </Link>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[
          ["Изучено", stats?.studied],
          ["Освоено", stats?.mastered],
          ["Всего", activeIds.length],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl bg-surface-2 px-2 py-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      {lastExam && (
        <p className="mt-3 text-sm text-muted">
          Последний экзамен: {lastExam.correct} из {lastExam.total}, {lastExam.passed ? "сдан ✅" : "не сдан"}
        </p>
      )}
    </section>
  );
}
