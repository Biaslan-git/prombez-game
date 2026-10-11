"use client";

import { useEffect, useRef } from "react";

/** Клавиши 1–9 — выбор ответа, Enter — ответить/дальше. Игнорируются при вводе текста. */
export function useAnswerHotkeys(handlers: { onDigit: (index: number) => void; onEnter: () => void }, enabled = true) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        ref.current.onDigit(Number(e.key) - 1);
      } else if (e.key === "Enter") {
        // Enter на сфокусированной кнопке ответа уже кликает её — не дублируем.
        if (t?.tagName === "BUTTON" || t?.tagName === "A") return;
        e.preventDefault();
        ref.current.onEnter();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
