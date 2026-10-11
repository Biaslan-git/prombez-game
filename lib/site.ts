export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://prombez-game.ru").replace(/\/$/, "");
export const SITE_NAME = "Промбез Game";
export const FEEDBACK_EMAIL = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL || "support@prombez-game.ru";

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function formatDateRu(date: string | Date | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export function pluralRu(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
