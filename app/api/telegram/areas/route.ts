import { NextResponse } from "next/server";
import { COURSES } from "@/lib/courses";
import { getPublishedAreas } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Сферы и опубликованные области в порядке главной: из них бот строит меню /settings (scripts/sync-bot.mjs). */
export async function GET() {
  const areas = (await getPublishedAreas()).map((a) => ({
    slug: a.slug,
    code: a.code,
    title: a.title,
    course: a.courseSlug || "prombez",
  }));
  const used = new Set(areas.map((a) => a.course));
  const courses = COURSES.filter((c) => used.has(c.slug)).map((c) => ({ slug: c.slug, title: c.title }));
  return NextResponse.json({ courses, areas }, { headers: { "cache-control": "public, s-maxage=3600" } });
}
