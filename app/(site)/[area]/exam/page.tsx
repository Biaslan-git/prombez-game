import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExamRunner } from "@/components/ExamRunner";
import { getArea, getAreaQuestions } from "@/lib/data";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ area: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const area = await getArea((await params).area);
  return { title: area ? `Пробный экзамен ${area.code}` : "Пробный экзамен", robots: { index: false, follow: true } };
}

export default async function ExamPage({ params }: Params) {
  const area = await getArea((await params).area);
  if (!area) notFound();
  const questions = await getAreaQuestions(area.id);
  return (
    <ExamRunner
      area={{ slug: area.slug, code: area.code, title: area.title }}
      questions={questions}
      config={{
        count: area.examQuestionsCount,
        timeLimitMin: area.examTimeLimitMin,
        passThreshold: area.examPassThreshold,
      }}
    />
  );
}
