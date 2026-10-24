import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { AreaDashboard } from "@/components/AreaProgressWidgets";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getArea, getAreaQuestionList, getAreaTopics, getPublishedAreas, safeStaticParams } from "@/lib/data";
import { courseOf } from "@/lib/courses";
import { formatDateRu, pageMetadata, pluralRu } from "@/lib/site";
import { truncate } from "@/lib/text";

export const revalidate = 3600;

type Params = { params: Promise<{ area: string }> };

export async function generateStaticParams() {
  return safeStaticParams(async () => (await getPublishedAreas()).map((a) => ({ area: a.slug })));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const area = await getArea((await params).area);
  if (!area) return {};
  const title = `${area.code} ${area.title} — вопросы и ответы${area.authority ? ` ${area.authority}` : ""}`;
  return pageMetadata({
    title,
    ogTitle: title,
    description:
      area.shortDescription ||
      `Подготовка к аттестации по области ${area.code}: ${area.questionCount} вопросов с ответами, тренировка и пробный экзамен.`,
    path: `/${area.slug}`,
  });
}

const CHUNK = 50;

export default async function AreaPage({ params }: Params) {
  const area = await getArea((await params).area);
  if (!area) notFound();
  const [list, topics] = await Promise.all([getAreaQuestionList(area.id), getAreaTopics(area.id)]);
  const activeIds = list.filter((q) => q.isActive).map((q) => q.id);

  const chunks: (typeof list)[] = [];
  for (let i = 0; i < list.length; i += CHUNK) chunks.push(list.slice(i, i + CHUNK));
  const updated = formatDateRu(area.bankUpdatedAt);
  const course = courseOf(area.courseSlug);
  const count = `${area.questionCount} ${pluralRu(area.questionCount, "вопрос", "вопроса", "вопросов")}`;

  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Главная", href: "/" },
          { name: course.title, href: `/kurs/${course.slug}` },
          { name: area.code, href: `/${area.slug}` },
        ]}
      />
      <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
        {area.code}. {area.title}
      </h1>
      {area.sectionTitle && area.sectionTitle !== area.title && <p className="mt-1 text-muted">{area.sectionTitle}</p>}
      <p className="mt-2 text-sm text-muted">
        {count}
        {updated && ` · База актуальна на ${updated}`}
        {area.bankVersion && ` · версия ${area.bankVersion}`}
      </p>
      {area.shortDescription && <p className="mt-3">{area.shortDescription}</p>}
      <p className="mt-2 text-muted">
        В области {area.code} {count}
        {area.authority ? ` официального банка ${area.authority}` : " с ответами"}. Можно тренироваться с интервальным
        повторением, пройти пробный экзамен и разобрать ошибки; у каждого вопроса есть страница с правильным ответом и
        ссылкой на норму.
      </p>

      <div className="mt-5">
        <AreaDashboard slug={area.slug} activeIds={activeIds} />
      </div>

      {topics.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-semibold">Вопросы по темам</h2>
          <ul className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <li key={t.slug}>
                <Link href={`/${area.slug}/t/${t.slug}`} className="btn-secondary text-sm">
                  {t.title} · {t.count}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

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
