import Link from "next/link";
import { AreaCardReadiness } from "@/components/AreaProgressWidgets";
import type { AreaSummary } from "@/lib/data";
import { formatDateRu, pluralRu } from "@/lib/site";

/** Карточка области: код, название, число вопросов, готовность и кнопка тренировки. */
export function AreaCard({ area: a }: { area: AreaSummary }) {
  return (
    <li className="flex flex-col rounded-2xl border border-line bg-surface p-4">
      <Link href={`/${a.slug}`} className="group">
        <span className="inline-block rounded-md bg-surface-2 px-2 py-0.5 text-sm font-semibold">{a.code}</span>
        <h3 className="mt-2 font-semibold leading-snug group-hover:underline">{a.title}</h3>
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
  );
}
