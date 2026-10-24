import { describe, expect, it } from "vitest";
import { sitemapIndexXml, urlsetXml } from "./sitemap";

describe("sitemap xml", () => {
  it("escapes urls and formats dates", () => {
    const xml = urlsetXml([
      { url: "https://x.ru/a?b=1&c=2", lastModified: new Date("2026-10-24T00:00:00Z"), priority: 0.6 },
    ]);
    expect(xml).toContain("<loc>https://x.ru/a?b=1&amp;c=2</loc>");
    expect(xml).toContain("<lastmod>2026-10-24T00:00:00.000Z</lastmod>");
    expect(xml).toContain("<priority>0.6</priority>");
  });

  it("builds an index", () => {
    const xml = sitemapIndexXml([{ url: "https://x.ru/sitemaps/main.xml" }]);
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("<sitemap><loc>https://x.ru/sitemaps/main.xml</loc></sitemap>");
  });
});
