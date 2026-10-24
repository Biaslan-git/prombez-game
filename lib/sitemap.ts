/**
 * Sitemap разбит на части: в одном файле не больше 50 000 адресов (ограничение протокола), а вопросов уже больше.
 * /sitemap.xml — индекс, /sitemaps/main.xml — служебные страницы, сферы, области и темы, /sitemaps/questions-N.xml — вопросы.
 */
export const QUESTIONS_PER_SITEMAP = 40_000;

export type SitemapEntry = {
  url: string;
  lastModified?: Date | string | null;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function isoDate(d: Date | string): string {
  return (typeof d === "string" ? new Date(d) : d).toISOString();
}

export function urlsetXml(entries: readonly SitemapEntry[]): string {
  const body = entries
    .map((e) => {
      const parts = [`<loc>${esc(e.url)}</loc>`];
      if (e.lastModified) parts.push(`<lastmod>${isoDate(e.lastModified)}</lastmod>`);
      if (e.changeFrequency) parts.push(`<changefreq>${e.changeFrequency}</changefreq>`);
      if (e.priority !== undefined) parts.push(`<priority>${e.priority}</priority>`);
      return `<url>${parts.join("")}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function sitemapIndexXml(items: readonly { url: string; lastModified?: Date | null }[]): string {
  const body = items
    .map(
      (i) =>
        `<sitemap><loc>${esc(i.url)}</loc>${i.lastModified ? `<lastmod>${isoDate(i.lastModified)}</lastmod>` : ""}</sitemap>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
