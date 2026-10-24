import Link from "next/link";
import { AdSlot } from "@/components/AdSlot";
import { JsonLd } from "@/components/JsonLd";
import { SearchForm } from "@/components/SearchForm";
import { TelegramSubscribe } from "@/components/TelegramSubscribe";
import { COURSES, courseOf, groupBySection } from "@/lib/courses";
import { getPublishedAreas } from "@/lib/data";
import { SITE_NAME, absoluteUrl, pageMetadata, pluralRu } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: `Тесты по промбезопасности, электробезопасности и охране труда ${new Date().getFullYear()} — тренажёр с ответами`,
  absoluteTitle: true,
  description:
    "Бесплатный тренажёр: вопросы Ростехнадзора с ответами по промышленной, энергетической и электробезопасности, тесты по охране труда, пожарной безопасности и другим направлениям. Тренировка, пробный экзамен, работа над ошибками. Без регистрации.",
  path: "/",
});

const FAQ = [
  {
    q: "Нужна ли регистрация?",
    a: "Нет. Откройте область аттестации и сразу отвечайте на вопросы. Прогресс сохраняется в вашем браузере.",
  },
  {
    q: "Это настоящие вопросы экзамена?",
    a: "По промышленной, энергетической и электробезопасности — да: тренажёр построен на открытых банках вопросов Ростехнадзора, по охране труда в ЕИСОТ — на вопросах Минтруда. Тесты по остальным направлениям учебные. Дата актуальности банка указана на странице каждой области.",
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
    q: "Какие направления есть кроме промбезопасности?",
    a: "Энергетическая и электробезопасность (II–V группы), гидротехнические сооружения, охрана труда (ЕИСОТ, программы А, Б, В, первая помощь, СИЗ, работы на высоте), пожарная, экологическая, радиационная, информационная и антитеррористическая безопасность, ГО и ЧС, безопасность дорожного движения, эксперты СОУТ и тесты для рабочих профессий.",
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
  const courses = COURSES.map((course) => {
    const items = areas.filter((a) => courseOf(a.courseSlug).slug === course.slug);
    return { course, items, questions: items.reduce((n, a) => n + a.questionCount, 0) };
  }).filter((c) => c.items.length > 0);
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
        Подготовка к аттестации по промбезопасности, электробезопасности и охране труда. Бесплатно, без регистрации
      </h1>
      <div className="mt-4">
        <SearchForm placeholder="Найдите вопрос по тексту" />
      </div>

      {areas.length === 0 ? (
        <p className="mt-6 text-muted">Области аттестации скоро появятся.</p>
      ) : (
        <>
          <section className="mt-6" aria-labelledby="courses-h">
            <h2 id="courses-h" className="mb-3 text-xl font-semibold">
              Направления
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {courses.map(({ course, items, questions }) => (
                <li key={course.slug}>
                  <Link
                    href={`/kurs/${course.slug}`}
                    className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-4 hover:border-brand/60"
                  >
                    <span className="font-semibold leading-snug group-hover:underline">{course.title}</span>
                    <span className="mt-1 text-sm text-muted">{course.description}</span>
                    <span className="mt-2 text-sm">
                      {items.length} {pluralRu(items.length, "тест", "теста", "тестов")} · {questions}{" "}
                      {pluralRu(questions, "вопрос", "вопроса", "вопросов")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10" aria-labelledby="all-h">
            <h2 id="all-h" className="mb-3 text-xl font-semibold">
              Все тесты
            </h2>
            <div className="space-y-2">
              {courses.map(({ course, items }, i) => (
                <details key={course.slug} open={i === 0} className="rounded-2xl border border-line bg-surface">
                  <summary className="cursor-pointer px-4 py-3 font-medium">
                    {course.title} <span className="text-muted">· {items.length}</span>
                  </summary>
                  <div className="border-t border-line px-4 pb-3">
                    {groupBySection(items).map((g, j) => (
                      <div key={j}>
                        {g.section && g.items.length > 1 && (
                          <h3 className="mt-3 text-sm font-semibold text-muted">{g.section}</h3>
                        )}
                        <ul>
                          {g.items.map((a) => (
                            <li key={a.id}>
                              <Link href={`/${a.slug}`} className="flex gap-3 py-1.5 hover:underline">
                                <span className="w-16 shrink-0 font-semibold tabular-nums">{a.code}</span>
                                <span className="flex-1">{a.title}</span>
                                <span className="shrink-0 text-sm text-muted tabular-nums">{a.questionCount}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        </>
      )}

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

      <div className="mt-10">
        <TelegramSubscribe where="home" />
      </div>

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
