import type { AreaProgress } from "./types";

/** День засчитывается в серию после стольких ответов. */
export const STREAK_DAILY_MIN = 10;

export function dayKey(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function prevDayKey(ts: number): string {
  const d = new Date(ts);
  d.setDate(d.getDate() - 1);
  return dayKey(d.getTime());
}

/** Учитывает один ответ в дневном счётчике и серии. */
export function registerDailyAnswer(p: AreaProgress, now: number): Pick<AreaProgress, "daily" | "streak"> {
  const today = dayKey(now);
  const count = (p.daily.day === today ? p.daily.count : 0) + 1;
  let streak = p.streak;
  if (count >= STREAK_DAILY_MIN && streak.lastDay !== today) {
    streak = { lastDay: today, days: streak.lastDay === prevDayKey(now) ? streak.days + 1 : 1 };
  }
  return { daily: { day: today, count }, streak };
}

/** Текущая серия: если вчера и сегодня не засчитаны, серия прервана. */
export function currentStreak(p: AreaProgress, now: number): number {
  const { lastDay, days } = p.streak;
  return lastDay === dayKey(now) || lastDay === prevDayKey(now) ? days : 0;
}

export function answersToday(p: AreaProgress, now: number): number {
  return p.daily.day === dayKey(now) ? p.daily.count : 0;
}
