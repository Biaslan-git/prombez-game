import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import { AreaCardReadiness } from "@/components/AreaProgressWidgets";
import { JsonLd } from "@/components/JsonLd";
import { SearchForm } from "@/components/SearchForm";
import { getPublishedAreas } from "@/lib/data";
import { SITE_NAME, absoluteUrl, formatDateRu, pageMetadata, pluralRu } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: `Тесты по промбезопасности Ростехнадзора ${new Date().getFullYear()} — тренажёр с ответами`,
  absoluteTitle: true,
  description:
    "Бесплатный тренажёр: вопросы Ростехнадзора с ответами по промышленной безопасности. Тренировка, пробный экзамен как в ЕПТ, работа над ошибками. Без регистрации.",
  path: "/",
});

const FAQ = [
  {
    q: "Нужна ли регистрация?",
    a: "Нет. Откройте область аттестации и сразу отвечайте на вопросы. Прогресс сохраняется в вашем браузере.",
  },
  {
    q: "Это настоящие вопросы экзамена?",
    a: "Тренажёр построен на открытых банках вопросов Ростехнадзора. Дата актуальности банка указана на карточке каждой области.",
  },
  {
    q: "Как устроен пробный экзамен?",
    a: "Как на ЕПТ: случайный билет, таймер, правильные ответы показываются только в конце. После экзамена ошибки попадают в «Работу над ошибками».",
  },
  {
    q: "Что такое готовность?",
    a: "Доля вопросов области, которые вы освоили: ответили верно несколько раз с перерывами в днях. Чем ближе к 100%, тем спокойнее на экзамене.",
  },
  {
    q: "Что такое ЕПТ?",
    a: "Единый портал тестирования Ростехнадзора: информационная система, в которой проходит компьютерное тестирование при аттестации по промышленной безопасности. Тренажёр помогает подготовиться к такому тестированию.",
  },
  {
    q: "Чем область А.1 отличается от областей Б?",
    a: "А.1 — основы промышленной безопасности, общие требования, которые нужны всем. Области Б — специальные требования по отраслям и видам объектов; их коды начинаются с Б.",
  },
  {
    q: "Что такое интервальное повторение?",
    a: "Способ запоминания: вопрос, на который вы ответили верно, показывается всё реже, а ошибка возвращается быстро. Так материал закрепляется надолго, а время тратится на то, что вы ещё не знаете.",
  },
  {
    q: "Сохраняется ли мой прогресс?",
    a: "Да, в вашем браузере на этом устройстве. Если очистить данные сайта или открыть его на другом устройстве, прогресс начнётся заново.",
  },
];

export default async function HomePage() {
  const areas = await getPublishedAreas();
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/icon-512.png"),
  };
  const siteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: absoluteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/search")}?q={query}`,
      "query-input": "required name=query",
    },
  };

  return (
    <>
      <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
        Подготовка к аттестации по промбезопасности. Бесплатно, без регистрации
      </h1>
      <div className="mt-4">
        <SearchForm placeholder="Найдите вопрос по тексту" />
      </div>

      <section className="mt-6" aria-label="Области аттестации">
        {areas.length === 0 ? (
          <p className="text-muted">Области аттестации скоро появятся.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {areas.map((a) => (
              <li key={a.id} className="flex flex-col rounded-2xl border border-line bg-surface p-4">
                <Link href={`/${a.slug}`} className="group">
                  <span className="inline-block rounded-md bg-surface-2 px-2 py-0.5 text-sm font-semibold">
                    {a.code}
                  </span>
                  <h2 className="mt-2 font-semibold leading-snug group-hover:underline">{a.title}</h2>
                </Link>
                <p className="mt-1 text-sm text-muted">
                  {a.questionCount} {pluralRu(a.questionCount, "вопрос", "вопроса", "вопросов")}
                  {formatDateRu(a.bankUpdatedAt) && ` · База актуальна на ${formatDateRu(a.bankUpdatedAt)}`}
                </p>
                <AreaCardReadiness slug={a.slug} total={a.questionCount} />
                <Link href={`/${a.slug}/train`} className="btn-primary mt-4 w-full">
                  Начать тренировку
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">Как это работает</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            ["Выберите область", "Сразу решайте вопросы своей области аттестации — без регистрации."],
            ["Тренируйтесь урывками", "Ошибки возвращаются для повторения, освоенные вопросы — реже."],
            ["Сдайте пробный экзамен", "Таймер и билет как на ЕПТ. Готовность покажет, когда вы готовы."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-2xl border border-line bg-surface p-4">
              <div className="text-sm font-semibold text-brand">Шаг {i + 1}</div>
              <div className="mt-1 font-semibold">{t}</div>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">Частые вопросы</h2>
        <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-4 py-3">
              <summary className="cursor-pointer list-none font-medium marker:hidden">
                <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-90">›</span>
                {f.q}
              </summary>
              <p className="mt-2 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <AdSlot id="home" />

      <JsonLd data={faqLd} />
      <JsonLd data={siteLd} />
      <JsonLd data={orgLd} />
    </>
  );
}
