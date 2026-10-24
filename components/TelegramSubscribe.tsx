"use client";

import { reachGoal } from "@/lib/metrika";
import { TELEGRAM_BOT } from "@/lib/site";

/**
 * Подписка на бота «Вопрос дня». Без настроенного бота ничего не показывает.
 * С area бот сразу добавляет эту область к выбору подписчика (/start a_<slug>).
 */
export function TelegramSubscribe({
  where,
  area,
  variant = "card",
}: {
  where: string;
  area?: string;
  variant?: "card" | "link";
}) {
  if (!TELEGRAM_BOT) return null;
  const href = `https://t.me/${TELEGRAM_BOT}?start=${area ? `a_${area}` : where}`;
  const onClick = () => reachGoal("telegram_click", { where });
  if (variant === "link") {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className="hover:text-fg">
        Вопрос дня в Telegram
      </a>
    );
  }
  return (
    <section className="mt-8 rounded-2xl border border-line bg-surface p-5">
      <p className="font-semibold">Вопрос дня в Telegram</p>
      <p className="mt-1 text-sm text-muted">
        Раз в день бот присылает один вопрос из выбранных вами областей: ответили и сразу видите результат. Сферы и
        области меняются командой /settings, отключить рассылку можно командой /stop.
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className="btn-secondary mt-4 w-full sm:w-auto"
      >
        Получать вопрос дня
      </a>
    </section>
  );
}
