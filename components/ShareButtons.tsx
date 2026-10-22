"use client";

import { useState } from "react";
import { reachGoal } from "@/lib/metrika";
import { telegramShareUrl, vkShareUrl, withUtm } from "@/lib/share";

/** Кнопки «Поделиться»: Telegram, VK и копирование ссылки. `where` — откуда нажали, для цели Метрики. */
export function ShareButtons({ url, text, where }: { url: string; text: string; where: string }) {
  const [copied, setCopied] = useState(false);
  const shared = withUtm(url, "share");

  function copy() {
    reachGoal("share_click", { where, via: "copy" });
    navigator.clipboard
      ?.writeText(shared)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Поделиться">
      <span className="text-sm text-muted">Поделиться:</span>
      <a
        href={telegramShareUrl(shared, text)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => reachGoal("share_click", { where, via: "telegram" })}
        className="btn-secondary text-sm"
      >
        Telegram
      </a>
      <a
        href={vkShareUrl(shared, text)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => reachGoal("share_click", { where, via: "vk" })}
        className="btn-secondary text-sm"
      >
        ВКонтакте
      </a>
      <button type="button" onClick={copy} className="btn-secondary text-sm">
        {copied ? "Ссылка скопирована ✓" : "Копировать ссылку"}
      </button>
    </div>
  );
}
