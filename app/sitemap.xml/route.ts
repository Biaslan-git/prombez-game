import { getSitemapEntries } from "@/lib/data";
import { QUESTIONS_PER_SITEMAP, sitemapIndexXml, xmlResponse } from "@/lib/sitemap";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET() {
  const questions = await getSitemapEntries();
  const parts = Math.max(1, Math.ceil(questions.length / QUESTIONS_PER_SITEMAP));
  const lastChange = (from: number, to: number) =>
    questions.slice(from, to).reduce<Date | null>((max, q) => (!max || q.updatedAt > max ? q.updatedAt : max), null);
  return xmlResponse(
    sitemapIndexXml([
      { url: absoluteUrl("/sitemaps/main.xml"), lastModified: lastChange(0, questions.length) },
      ...Array.from({ length: parts }, (_, i) => ({
        url: absoluteUrl(`/sitemaps/questions-${i}.xml`),
        lastModified: lastChange(i * QUESTIONS_PER_SITEMAP, (i + 1) * QUESTIONS_PER_SITEMAP),
      })),
    ]),
  );
}
