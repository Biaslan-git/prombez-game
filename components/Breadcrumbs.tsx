import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { absoluteUrl } from "@/lib/site";

export type Crumb = { name: string; href: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.href),
    })),
  };
  return (
    <>
      <nav aria-label="Навигационная цепочка" className="mb-4 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          {items.map((c, i) => (
            <li key={c.href} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden>/</span>}
              {i === items.length - 1 ? (
                <span aria-current="page" className="text-fg">
                  {c.name}
                </span>
              ) : (
                <Link href={c.href} className="hover:text-fg hover:underline">
                  {c.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={ld} />
    </>
  );
}
