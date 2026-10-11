import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trainer } from "@/components/Trainer";
import { getArea, getAreaQuestions } from "@/lib/data";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ area: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const area = await getArea((await params).area);
  return { title: area ? `Тренировка ${area.code}` : "Тренировка", robots: { index: false, follow: true } };
}

export default async function TrainPage({ params }: Params) {
  const area = await getArea((await params).area);
  if (!area) notFound();
  const questions = await getAreaQuestions(area.id);
  return <Trainer area={{ slug: area.slug, code: area.code }} questions={questions} />;
}
