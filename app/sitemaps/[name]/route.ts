import { type NextRequest } from "next/server";
import { COURSES, courseOf } from "@/lib/courses";
import { getAreaTopics, getPublishedAreas, getSitemapEntries } from "@/lib/data";
import { QUESTIONS_PER_SITEMAP, urlsetXml, xmlResponse, type SitemapEntry } from "@/lib/sitemap";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

// Дата последней правки служебных страниц (политика конфиденциальности, «О проекте»).
const PAGES_UPDATED = new Date("2026-10-24");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const name = (await params).name;
  if (name === "main.xml") return xmlResponse(urlsetXml(await mainEntries()));
  const m = /^questions-(\d+)\.xml$/.exec(name);
  if (!m) return new Response("Not found", { status: 404 });
  const part = Number(m[1]);
  const questions = (await getSitemapEntries()).slice(part * QUESTIONS_PER_SITEMAP, (part + 1) * QUESTIONS_PER_SITEMAP);
  if (questions.length === 0 && part > 0) return new Response("Not found", { status: 404 });
  return xmlResponse(
    urlsetXml(
      questions.map((q) => ({
        url: absoluteUrl(`/${q.areaSlug}/q/${q.slug}`),
        lastModified: q.updatedAt,
        changeFrequency: "monthly",
        priority: 0.6,
      })),
    ),
  );
}

async function mainEntries(): Promise<SitemapEntry[]> {
  const [areas, questions] = await Promise.all([getPublishedAreas(), getSitemapEntries()]);
  const topics = (
    await Promise.all(areas.map(async (a) => (await getAreaTopics(a.id)).map((t) => ({ area: a, slug: t.slug }))))
  ).flat();
  // Дата последнего изменения содержимого сайта: самая свежая правка вопросов.
  const lastContentChange = questions.reduce<Date | undefined>(
    (max, q) => (!max || q.updatedAt > max ? q.updatedAt : max),
    undefined,
  );
  const courses = COURSES.filter((c) => areas.some((a) => courseOf(a.courseSlug).slug === c.slug));
  return [
    { url: absoluteUrl("/"), lastModified: lastContentChange, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/search"), changeFrequency: "monthly", priority: 0.3 },
    { url: absoluteUrl("/about"), lastModified: PAGES_UPDATED, changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/privacy"), lastModified: PAGES_UPDATED, changeFrequency: "yearly", priority: 0.1 },
    ...courses.map((c) => ({
      url: absoluteUrl(`/kurs/${c.slug}`),
      lastModified: lastContentChange,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...areas.map((a) => ({
      url: absoluteUrl(`/${a.slug}`),
      lastModified: a.bankUpdatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...topics.map((t) => ({
      url: absoluteUrl(`/${t.area.slug}/t/${t.slug}`),
      lastModified: t.area.bankUpdatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
