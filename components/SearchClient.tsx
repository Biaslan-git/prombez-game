"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Highlight } from "@/components/Highlight";
import type { SearchResult } from "@/lib/data";
import { reachGoal } from "@/lib/metrika";

const DEBOUNCE_MS = 300;

/**
 * Поиск с debounce. Без JS работает как обычная GET-форма (SSR-результаты),
 * с JS — обновляет результаты на лету и URL через history.replaceState.
 */
export function SearchClient({
  initialQuery,
  initialResults,
}: {
  initialQuery: string;
  initialResults: SearchResult[];
}) {
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState(initialResults);
  const [searched, setSearched] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);
  const goalSent = useRef(false);

  useEffect(() => {
    if (initialQuery && !goalSent.current) {
      goalSent.current = true;
      reachGoal("search_used");
    }
  }, [initialQuery]);

  useEffect(() => {
    const term = q.trim();
    if (term === searched) return;
    const id = ++reqId.current;
    const timer = window.setTimeout(async () => {
      const url = new URL(window.location.href);
      if (term) url.searchParams.set("q", term);
      else url.searchParams.delete("q");
      window.history.replaceState(null, "", url);
      if (term.length < 2) {
        setResults([]);
        setSearched(term);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        const data = (await res.json()) as { results: SearchResult[] };
        if (id !== reqId.current) return;
        setResults(data.results ?? []);
        setSearched(term);
        if (!goalSent.current) {
          goalSent.current = true;
          reachGoal("search_used");
        }
      } catch {
        // Сеть недоступна — оставляем прежние результаты.
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q, searched]);

  return (
    <div>
      <form action="/search" method="get" role="search" className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
        <input
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Найдите вопрос по тексту"
          aria-label="Текст вопроса"
          autoFocus={!initialQuery}
          className="min-h-12 w-full min-w-0 rounded-xl border-2 border-line bg-surface px-4 outline-none focus:border-brand"
        />
        <noscript>
          <button type="submit" className="btn-secondary">
            Найти
          </button>
        </noscript>
      </form>

      <div className="mt-5" aria-live="polite" aria-busy={loading}>
        {searched && searched.length >= 2 && (
          <p className="mb-3 text-sm text-muted">
            {results.length === 0 ? "Ничего не нашлось. Попробуйте другие слова." : `Найдено: ${results.length}`}
          </p>
        )}
        <ul className={`space-y-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {results.map((r) => (
            <li key={`${r.areaSlug}/${r.slug}`}>
              <Link
                href={`/${r.areaSlug}/q/${r.slug}`}
                className="block rounded-2xl border border-line bg-surface p-4 hover:border-brand/60"
              >
                <span className="text-sm text-muted">
                  {r.areaCode} · вопрос №{r.number}
                </span>
                <span className="mt-1 block font-medium">
                  <Highlight text={r.headline} />
                </span>
                {r.correct.length > 0 && (
                  <span className="mt-2 block text-sm">
                    <span className="text-ok">✓</span> {r.correct.join("; ")}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
