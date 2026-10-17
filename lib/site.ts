import type { Metadata } from "next";

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

export const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Промбез Game — вопросы Ростехнадзора с ответами",
};

/**
 * Общие метаданные страницы: canonical, Open Graph (с og:url и картинкой) и Twitter Card.
 * Next целиком заменяет объект openGraph при переопределении, поэтому поля сайта повторяем здесь.
 */
export function pageMetadata(o: {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
  ogTitle?: string;
  type?: "website" | "article";
  /** Если страница — копия другой, canonical указывает на главную (og:url остаётся своим). */
  canonical?: string;
}): Metadata {
  const ogTitle = o.ogTitle ?? o.title;
  return {
    title: o.absoluteTitle ? { absolute: o.title } : o.title,
    description: o.description,
    alternates: { canonical: o.canonical ?? o.path },
    openGraph: {
      siteName: SITE_NAME,
      locale: "ru_RU",
      type: o.type ?? "website",
      url: o.path,
      title: ogTitle,
      description: o.description,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title: ogTitle, description: o.description, images: [OG_IMAGE.url] },
  };
}

export const SOURCE_URL = "https://xn----8sbbilafpyxcf8a.xn--p1ai/";
export const SOURCE_NAME = "блог-инженера.рф";
