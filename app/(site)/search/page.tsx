import type { Metadata } from "next";
import { SearchClient } from "@/components/SearchClient";
import { searchQuestions } from "@/lib/data";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = firstParam((await searchParams).q);
  return {
    title: q ? `Поиск: ${q}` : "Поиск по вопросам",
    description: "Поиск по тексту вопросов аттестации по промышленной безопасности с правильными ответами.",
    alternates: { canonical: "/search" },
    // Страницы результатов не индексируем, чтобы не плодить дубли с query-параметрами.
    robots: q ? { index: false, follow: true } : undefined,
  };
}

function firstParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export default async function SearchPage({ searchParams }: Props) {
  const q = firstParam((await searchParams).q);
  const results = q ? await searchQuestions(q) : [];
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Поиск по вопросам</h1>
      <SearchClient initialQuery={q} initialResults={results} />
    </>
  );
}
