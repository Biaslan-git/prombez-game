"use client";

import { useCallback, useEffect, useState } from "react";
import { localProgressStore, type AreaProgress, type ProgressStore } from "@/lib/progress";

/**
 * Прогресс области из хранилища. До монтирования (SSR) — null.
 * update() применяет изменение и сразу сохраняет.
 */
export function useAreaProgress(areaSlug: string, store: ProgressStore = localProgressStore) {
  const [progress, setProgress] = useState<AreaProgress | null>(null);

  useEffect(() => {
    setProgress(store.load(areaSlug));
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.endsWith(`:progress:${areaSlug}`)) setProgress(store.load(areaSlug));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [areaSlug, store]);

  const update = useCallback(
    (fn: (p: AreaProgress) => AreaProgress) => {
      // Читаем свежую версию из хранилища: прогресс могли изменить в другой вкладке.
      const next = fn(store.load(areaSlug));
      store.save(areaSlug, next);
      setProgress(next);
      return next;
    },
    [areaSlug, store],
  );

  return { progress, update };
}
