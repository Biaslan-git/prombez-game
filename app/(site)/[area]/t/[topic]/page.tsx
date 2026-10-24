import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { getArea, getAreaTopics, getPublishedAreas, getTopicQuestions, safeStaticParams } from "@/lib/data";
import { courseOf } from "@/lib/courses";
import { absoluteUrl, formatDateRu, pageMetadata, pluralRu } from "@/lib/site";
import { truncate } from "@/lib/text";

export const revalidate = 86400;

type Params = { params: Promise<{ area: string; topic: string }> };

export async function generateStaticParams() {
  return safeStaticParams(async () => {
    const areas = await getPublishedAreas();
    const perArea = await Promise.all(
      areas.map(async (a) => (await getAreaTopics(a.id)).map((t) => ({ area: a.slug, topic: t.slug }))),
    );
    return perArea.flat();
  });
}

async function load(params: Params["params"]) {
  const { area: areaSlug, topic: topicSlug } = await params;
  const area = await getArea(areaSlug);
  if (!area) return null;
  const data = await getTopicQuestions(area.id, topicSlug);
  return data ? { area, ...data } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load(params);
  if (!data) return {};
  const { area, topic, questions } = data;
  return pageMetadata({
    title: `${topic.title}: вопросы и ответы ${area.code}${area.authority ? ` — ${area.authority}` : ""}`,
    absoluteTitle: true,
    ogTitle: `${topic.title} — вопросы ${area.code} с ответами`,
    description: `${questions.length} ${pluralRu(questions.length, "вопрос", "вопроса", "вопросов")} области ${area.code} про ${topic.about}: правильные ответы и тренажёр. Бесплатно, без регистрации.`,
    path: `/${area.slug}/t/${topic.slug}`,
  });
}

export default async function TopicPage({ params }: Params) {
  const data = await load(params);
  if (!data) notFound();
  const { area, topic, questions } = data;
  const path = `/${area.slug}/t/${topic.slug}`;
  const others = (await getAreaTopics(area.id)).filter((t) => t.slug !== topic.slug);
  const updated = formatDateRu(area.bankUpdatedAt);

  const listLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${topic.title} — вопросы ${area.code}`,
    numberOfItems: questions.length,
    itemListElement: questions.map((q, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(`/${area.slug}/q/${q.slug}`),
      name: truncate(q.text, 110),
    })),
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Главная", href: "/" },
          { name: courseOf(area.courseSlug).title, href: `/kurs/${courseOf(area.courseSlug).slug}` },
          { name: area.code, href: `/${area.slug}` },
          { name: topic.title, href: path },
        ]}
      />
      <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
        {topic.title}: вопросы и ответы {area.code}
      </h1>
      <p className="mt-2 text-muted">
        {questions.length} {pluralRu(questions.length, "вопрос", "вопроса", "вопросов")}
        {area.authority ? ` банка ${area.authority}` : ""} по области{" "}
        <Link href={`/${area.slug}`} className="underline">
          {area.code}. {area.title}
        </Link>{" "}
        про {topic.about}
        {updated && `. База актуальна на ${updated}`}. У каждого вопроса есть отдельная страница со всеми вариантами и
        ссылкой на норму.
      </p>

      <ol className="mt-6 flex flex-col gap-3">
        {questions.map((q) => {
          const correct = q.answers.filter((a) => a.isCorrect).map((a) => a.text);
          return (
            <li key={q.id} className="rounded-2xl border border-line bg-surface p-4">
              <h2 className="font-semibold leading-snug">
                <Link href={`/${area.slug}/q/${q.slug}`} className="hover:underline">
                  <span className="mr-2 text-muted tabular-nums">№{q.number}</span>
                  {truncate(q.text, 220)}
                </Link>
              </h2>
              <p className="mt-2 rounded-xl bg-ok-bg px-3 py-2 text-sm">
                <b>
                  {q.kind === "order"
                    ? "Правильный порядок:"
                    : q.kind === "match"
                      ? "Правильные пары:"
                      : "Правильный ответ:"}
                </b>{" "}
                {correct.join(q.kind === "order" ? " → " : "; ")}
              </p>
            </li>
          );
        })}
      </ol>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-5 text-center">
        <p className="font-semibold">Закрепите тему в тренировке</p>
        <p className="mt-1 text-sm text-muted">Ошибки возвращаются для повторения, освоенное показывается реже.</p>
        <Link href={`/${area.slug}/train`} className="btn-primary mt-4 w-full sm:w-auto">
          Начать тренировку
        </Link>
      </section>

      {others.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Другие темы области {area.code}</h2>
          <ul className="flex flex-wrap gap-2">
            {others.map((t) => (
              <li key={t.slug}>
                <Link href={`/${area.slug}/t/${t.slug}`} className="btn-secondary text-sm">
                  {t.title} · {t.count}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <JsonLd data={listLd} />
    </>
  );
}
