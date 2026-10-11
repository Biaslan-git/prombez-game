import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { getArea, getQuestionPage, getSimilarQuestions, getSitemapEntries, safeStaticParams } from "@/lib/data";
import { absoluteUrl, pluralRu } from "@/lib/site";
import { truncate } from "@/lib/text";

export const revalidate = 86400;

type Params = { params: Promise<{ area: string; slug: string }> };

export async function generateStaticParams() {
  return safeStaticParams(async () => (await getSitemapEntries()).map((e) => ({ area: e.areaSlug, slug: e.slug })));
}

async function load(params: Params["params"]) {
  const { area: areaSlug, slug } = await params;
  const area = await getArea(areaSlug);
  if (!area) return null;
  const q = await getQuestionPage(area.id, decodeURIComponent(slug));
  return q ? { area, q } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load(params);
  if (!data) return {};
  const { area, q } = data;
  const correct = q.answers.filter((a) => a.isCorrect).map((a) => a.text);
  return {
    title: { absolute: `${truncate(q.text, 70)} — ответ | Промбез ${area.code}` },
    description: truncate(`Правильный ответ: ${correct.join("; ")}`, 160),
    alternates: { canonical: `/${area.slug}/q/${q.slug}` },
    openGraph: { type: "article", title: truncate(q.text, 90) },
  };
}

export default async function QuestionPage({ params }: Params) {
  const data = await load(params);
  if (!data) notFound();
  const { area, q } = data;
  const correct = q.answers.filter((a) => a.isCorrect);
  const similar = await getSimilarQuestions(area.id, q.id, q.text);
  const url = absoluteUrl(`/${area.slug}/q/${q.slug}`);

  const qaLd = {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: truncate(q.text, 110),
      text: q.text,
      answerCount: 1,
      dateCreated: q.updatedAt.toISOString(),
      author: { "@type": "Organization", name: "Промбез Game", url: absoluteUrl("/") },
      acceptedAnswer: {
        "@type": "Answer",
        text: correct.map((a) => a.text).join("; ") + (q.explanation ? `\n\n${q.explanation}` : ""),
        url,
        dateCreated: q.updatedAt.toISOString(),
        upvoteCount: 1,
        author: { "@type": "Organization", name: "Промбез Game", url: absoluteUrl("/") },
      },
    },
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Главная", href: "/" },
          { name: area.code, href: `/${area.slug}` },
          { name: `Вопрос №${q.number}`, href: `/${area.slug}/q/${q.slug}` },
        ]}
      />

      {!q.isActive && (
        <p className="mb-4 rounded-xl bg-warn-bg px-4 py-3 text-sm">
          Вопрос исключён из актуального банка вопросов и на экзамене не встречается.
        </p>
      )}

      <article>
        <p className="mb-2 text-sm text-muted">
          {area.code} · вопрос №{q.number}
          {correct.length > 1 && " · несколько правильных ответов"}
        </p>
        <h1 className="text-xl font-semibold leading-snug sm:text-2xl">{truncate(q.text, 300)}</h1>
        {q.text.length > 300 && <p className="mt-2">{q.text}</p>}

        <h2 className="sr-only">Варианты ответа</h2>
        <ul className="mt-5 flex flex-col gap-2.5">
          {q.answers.map((a, i) => (
            <li
              key={a.id}
              className={`flex gap-3 rounded-xl border-2 px-3.5 py-3 ${
                a.isCorrect ? "border-ok bg-ok-bg" : "border-line bg-surface"
              }`}
            >
              <span aria-hidden className="w-5 shrink-0 font-semibold text-muted">
                {a.isCorrect ? "✓" : i + 1}
              </span>
              <span>
                {a.text}
                {a.isCorrect && <strong className="ml-2 text-sm text-ok">— правильный ответ</strong>}
              </span>
            </li>
          ))}
        </ul>

        {(q.explanation || q.normRef) && (
          <section className="mt-5 rounded-xl border border-line bg-surface p-4">
            {q.explanation && (
              <>
                <h2 className="mb-1 font-semibold">Почему так</h2>
                <p className="whitespace-pre-line">{q.explanation}</p>
              </>
            )}
            {q.normRef && <p className={`text-sm text-muted ${q.explanation ? "mt-2" : ""}`}>Норма: {q.normRef}</p>}
          </section>
        )}
      </article>

      <AdSlot id="question" />

      <nav aria-label="Соседние вопросы" className="mt-6 grid grid-cols-2 gap-2">
        {q.prev ? (
          <Link href={`/${area.slug}/q/${q.prev.slug}`} rel="prev" className="btn-secondary text-sm">
            ← Вопрос №{q.prev.number}
          </Link>
        ) : (
          <span />
        )}
        {q.next ? (
          <Link href={`/${area.slug}/q/${q.next.slug}`} rel="next" className="btn-secondary text-sm">
            Вопрос №{q.next.number} →
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5 text-center">
        <p className="font-semibold">
          Тренируйте все {area.questionCount} {pluralRu(area.questionCount, "вопрос", "вопроса", "вопросов")} области{" "}
          {area.code}
        </p>
        <p className="mt-1 text-sm text-muted">Бесплатно и без регистрации: ошибки повторяются, готовность растёт.</p>
        <Link href={`/${area.slug}/train`} className="btn-primary mt-4 w-full sm:w-auto">
          Начать тренировку
        </Link>
      </section>

      {similar.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Похожие вопросы</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {similar.map((s) => (
              <li key={s.slug}>
                <Link href={`/${area.slug}/q/${s.slug}`} className="flex gap-3 px-4 py-2.5 hover:bg-surface-2">
                  <span className="w-8 shrink-0 text-right text-muted tabular-nums">{s.number}</span>
                  <span>{truncate(s.text, 140)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AdSlot id="questionBottom" />
      <JsonLd data={qaLd} />
    </>
  );
}
