import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { AreaDashboard } from "@/components/AreaProgressWidgets";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getArea, getAreaQuestionList, getPublishedAreas, safeStaticParams } from "@/lib/data";
import { formatDateRu, pluralRu } from "@/lib/site";
import { truncate } from "@/lib/text";

export const revalidate = 3600;

type Params = { params: Promise<{ area: string }> };

export async function generateStaticParams() {
  return safeStaticParams(async () => (await getPublishedAreas()).map((a) => ({ area: a.slug })));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const area = await getArea((await params).area);
  if (!area) return {};
  return {
    title: `${area.code} ${area.title} — тренажёр и ответы на вопросы`,
    description:
      area.shortDescription ||
      `Подготовка к аттестации по области ${area.code}: ${area.questionCount} вопросов с ответами, тренировка и пробный экзамен.`,
    alternates: { canonical: `/${area.slug}` },
  };
}

const CHUNK = 50;

export default async function AreaPage({ params }: Params) {
  const area = await getArea((await params).area);
  if (!area) notFound();
  const list = await getAreaQuestionList(area.id);
  const activeIds = list.filter((q) => q.isActive).map((q) => q.id);

  const chunks: (typeof list)[] = [];
  for (let i = 0; i < list.length; i += CHUNK) chunks.push(list.slice(i, i + CHUNK));
  const updated = formatDateRu(area.bankUpdatedAt);

  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Главная", href: "/" },
          { name: area.code, href: `/${area.slug}` },
        ]}
      />
      <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
        {area.code}. {area.title}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {area.questionCount} {pluralRu(area.questionCount, "вопрос", "вопроса", "вопросов")}
        {updated && ` · База актуальна на ${updated}`}
        {area.bankVersion && ` · версия ${area.bankVersion}`}
      </p>
      {area.shortDescription && <p className="mt-3">{area.shortDescription}</p>}

      <div className="mt-5">
        <AreaDashboard slug={area.slug} activeIds={activeIds} />
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">Все вопросы области {area.code}</h2>
        <div className="space-y-2">
          {chunks.map((chunk, i) => (
            <details key={i} open={i === 0} className="rounded-2xl border border-line bg-surface">
              <summary className="cursor-pointer px-4 py-3 font-medium">
                Вопросы {chunk[0]!.number}–{chunk[chunk.length - 1]!.number}
              </summary>
              <ol className="divide-y divide-line border-t border-line">
                {chunk.map((q) => (
                  <li key={q.slug}>
                    <Link href={`/${area.slug}/q/${q.slug}`} className="flex gap-3 px-4 py-2.5 hover:bg-surface-2">
                      <span className="w-8 shrink-0 text-right text-muted tabular-nums">{q.number}</span>
                      <span className={q.isActive ? "" : "text-muted line-through"}>{truncate(q.text, 140)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      </section>

      <AdSlot id="area" />
    </>
  );
}
