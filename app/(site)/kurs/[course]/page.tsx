import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { AreaCard } from "@/components/AreaCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SearchForm } from "@/components/SearchForm";
import { COURSES, getCourse, groupBySection } from "@/lib/courses";
import { getCourseAreas, safeStaticParams } from "@/lib/data";
import { pageMetadata, pluralRu } from "@/lib/site";

export const revalidate = 3600;

type Params = { params: Promise<{ course: string }> };

export async function generateStaticParams() {
  return safeStaticParams(async () => COURSES.map((c) => ({ course: c.slug })));
}

async function load(params: Params["params"]) {
  const course = getCourse((await params).course);
  if (!course) return null;
  const areas = await getCourseAreas(course.slug);
  return areas.length ? { course, areas } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load(params);
  if (!data) return {};
  const { course, areas } = data;
  const title = `${course.title}: тесты с ответами ${new Date().getFullYear()}`;
  return pageMetadata({
    title,
    ogTitle: title,
    description: `${areas.length} ${pluralRu(areas.length, "тест", "теста", "тестов")} с ответами. ${course.description} Тренировка и пробный экзамен — бесплатно, без регистрации.`,
    path: `/kurs/${course.slug}`,
  });
}

export default async function CoursePage({ params }: Params) {
  const data = await load(params);
  if (!data) notFound();
  const { course, areas } = data;
  const questions = areas.reduce((n, a) => n + a.questionCount, 0);

  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Главная", href: "/" },
          { name: course.title, href: `/kurs/${course.slug}` },
        ]}
      />
      <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{course.title}: тесты с ответами</h1>
      <p className="mt-2 text-muted">
        {course.description} {areas.length} {pluralRu(areas.length, "тест", "теста", "тестов")}, {questions}{" "}
        {pluralRu(questions, "вопрос", "вопроса", "вопросов")}.
      </p>
      <div className="mt-4">
        <SearchForm placeholder="Найдите вопрос по тексту" />
      </div>

      {groupBySection(areas).map((g, i) => (
        <section key={i} className="mt-8">
          {g.section && <h2 className="mb-3 text-xl font-semibold">{g.section}</h2>}
          <ul className="grid gap-3 sm:grid-cols-2">
            {g.items.map((a) => (
              <AreaCard key={a.id} area={a} />
            ))}
          </ul>
        </section>
      ))}

      <AdSlot id="area" />
    </>
  );
}
