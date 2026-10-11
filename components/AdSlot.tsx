"use client";

import { useEffect, useId, useRef } from "react";
import { adBlockId, type AdPlacement } from "@/lib/ads/config";

declare global {
  interface Window {
    yaContextCb?: Array<() => void>;
    Ya?: { Context: { AdvManager: { render: (opts: { blockId: string; renderTo: string }) => void } } };
  }
}

const SCRIPT_SRC = "https://yandex.ru/ads/system/context.js";

function ensureLoader() {
  window.yaContextCb = window.yaContextCb || [];
  if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
  const s = document.createElement("script");
  s.src = SCRIPT_SRC;
  s.async = true;
  document.head.appendChild(s);
}

/**
 * Рекламный блок РСЯ. Не рендерится, если реклама выключена флагом или ID блока не задан.
 * Высота резервируется заранее, чтобы не было сдвига вёрстки (CLS).
 */
export function AdSlot({
  id,
  minHeight = 250,
  className = "",
}: {
  id: AdPlacement;
  minHeight?: number;
  className?: string;
}) {
  const blockId = adBlockId(id);
  const domId = `yandex_rtb_${blockId}_${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const rendered = useRef(false);

  useEffect(() => {
    if (!blockId || rendered.current) return;
    rendered.current = true;
    try {
      ensureLoader();
      window.yaContextCb!.push(() => window.Ya?.Context.AdvManager.render({ blockId, renderTo: domId }));
    } catch {
      // Блокировщик рекламы или ошибка сети — место просто остаётся пустым.
    }
  }, [blockId, domId]);

  if (!blockId) return null;
  return (
    <aside aria-label="Реклама" className={`my-6 overflow-hidden ${className}`} style={{ minHeight }}>
      <div id={domId} />
    </aside>
  );
}
