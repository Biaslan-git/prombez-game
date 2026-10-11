import type { MetadataRoute } from "next";
import { getPublishedAreas, getSitemapEntries } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [areas, questions] = await Promise.all([getPublishedAreas(), getSitemapEntries()]);
  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/search"), changeFrequency: "monthly", priority: 0.3 },
    { url: absoluteUrl("/about"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.1 },
    ...areas.map((a) => ({
      url: absoluteUrl(`/${a.slug}`),
      lastModified: a.bankUpdatedAt ?? undefined,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...questions.map((q) => ({
      url: absoluteUrl(`/${q.areaSlug}/q/${q.slug}`),
      lastModified: q.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
