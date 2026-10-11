"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const KEY = "pg:cookies-ok";

/**
 * Минимальный баннер о cookies внизу экрана. Пока он виден, его высота пишется в --cookie-h:
 * body получает такой же отступ снизу, а закреплённые кнопки поднимаются над баннером — контент не перекрывается.
 */
export function CookieBanner() {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== "1");
    } catch {
      setShow(false);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!show || !el) {
      root.style.removeProperty("--cookie-h");
      return;
    }
    const sync = () => root.style.setProperty("--cookie-h", `${el.offsetHeight}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--cookie-h");
    };
  }, [show]);

  if (!show) return null;

  function accept() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setShow(false);
  }

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Уведомление о cookies"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-2 text-xs text-muted"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
        <p className="flex-1">
          Сайт использует cookies (Яндекс Метрика и реклама).{" "}
          <Link href="/privacy" className="underline">
            Подробнее
          </Link>
        </p>
        <button
          type="button"
          onClick={accept}
          className="shrink-0 rounded-md bg-surface px-3 py-1.5 font-medium text-fg"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
