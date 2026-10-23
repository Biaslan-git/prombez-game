import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { MiniQuiz } from "@/components/MiniQuiz";
import { ShareButtons } from "@/components/ShareButtons";
import { TelegramSubscribe } from "@/components/TelegramSubscribe";
import {
  getArea,
  getAreaQuestions,
  getAreaTopics,
  getDuplicateTargets,
  getQuestionPage,
  getSimilarQuestions,
  getSitemapEntries,
  safeStaticParams,
} from "@/lib/data";
import { absoluteUrl, formatDateRu, pageMetadata, pluralRu } from "@/lib/site";
import { pickQuizQuestions } from "@/lib/quiz";
import { questionHint, truncate } from "@/lib/text";
import { topicsFor } from "@/lib/topics";

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
  const main = (await getDuplicateTargets()).get(q.id);
  return pageMetadata({
    title: `${truncate(q.text, 70)} — ответ | Бесплатный тренажёр ${area.code}`,
    absoluteTitle: true,
    ogTitle: truncate(q.text, 90),
    // Сам ответ в описание не выносим: он уже есть в расширенном результате, а описание должно звать на страницу.
    description: truncate(
      `Все варианты ответа${q.normRef ? ", ссылка на норму" : ""} и тренажёр на ${area.questionCount} ${pluralRu(area.questionCount, "вопрос", "вопроса", "вопросов")} области ${area.code} с пробным экзаменом — бесплатно, без регистрации.`,
      160,
    ),
    path: `/${area.slug}/q/${q.slug}`,
    canonical: main && `/${main.areaSlug}/q/${main.slug}`,
    type: "article",
  });
}

export default async function QuestionPage({ params }: Params) {
  const data = await load(params);
  if (!data) notFound();
  const { area, q } = data;
  const correct = q.answers.filter((a) => a.isCorrect);
  const [similar, areaTopics, areaQuestions] = await Promise.all([
    getSimilarQuestions(area.id, q.id, q.text),
    getAreaTopics(area.id),
    getAreaQuestions(area.id),
  ]);
  const quizQuestions = pickQuizQuestions(areaQuestions, q);
  const hint = questionHint(q.text, correct.length);
  const myTopics = topicsFor(q.text)
    .map((t) => areaTopics.find((a) => a.slug === t.slug))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .slice(0, 4);
  const main = (await getDuplicateTargets()).get(q.id);
  const url = absoluteUrl(main ? `/${main.areaSlug}/q/${main.slug}` : `/${area.slug}/q/${q.slug}`);

  // Разметки QAPage нет намеренно (с 23.10.2026): с ней ответ показывался прямо в выдаче Google
  // (684 показа расширенного результата → 0 кликов). Вернуть её стоит, только если CTR без неё не вырастет.
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
        {hint && <p className="mt-2 text-muted">{hint}</p>}

        <p className="mt-4 rounded-xl bg-ok-bg px-4 py-3">
          <b>Правильный ответ:</b> {correct.map((a) => a.text).join("; ")}
        </p>
        <p className="mt-2 text-sm text-muted">
          Вопрос №{q.number} из банка Ростехнадзора по области{" "}
          <Link href={`/${area.slug}`} className="underline">
            {area.code}. {area.title}
          </Link>
          {formatDateRu(area.bankUpdatedAt) && `. Банк актуален на ${formatDateRu(area.bankUpdatedAt)}`}.
        </p>
        <p className="mt-3">
          <Link href={`/${area.slug}/train`} className="font-semibold underline">
            Потренироваться по всем {area.questionCount} вопросам области {area.code} →
          </Link>
        </p>
        <div className="mt-3">
          <ShareButtons
            url={url}
            text={`${truncate(q.text, 120)} Ответ на вопрос из банка Ростехнадзора:`}
            where="question"
          />
        </div>

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

      <MiniQuiz
        area={{ slug: area.slug, code: area.code }}
        questions={quizQuestions}
        topicTitle={myTopics[0]?.title ?? null}
        pageUrl={url}
      />

      <TelegramSubscribe where="question" />

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

      {myTopics.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Ещё по теме</h2>
          <ul className="flex flex-wrap gap-2">
            {myTopics.map((t) => (
              <li key={t.slug}>
                <Link href={`/${area.slug}/t/${t.slug}`} className="btn-secondary text-sm">
                  {t.title} · {t.count}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

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
    </>
  );
}
