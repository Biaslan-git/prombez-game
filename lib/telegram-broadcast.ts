import type { TgResult } from "./telegram-api";

export type Subscriber = { chatId: string; lastSentDay: number | null };

export type BroadcastDeps = {
  subscribers: Subscriber[];
  day: number;
  send: (chatId: string) => Promise<TgResult>;
  markSent: (chatId: string, day: number) => Promise<void>;
  deactivate: (chatId: string) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
};

export type BroadcastReport = { sent: number; alreadySent: number; blocked: number; failed: number };

/** Бот заблокирован пользователем или чат больше не существует: подписчика отключаем. */
export function isGone(r: Extract<TgResult, { ok: false }>): boolean {
  return r.status === 403 || (r.status === 400 && /chat not found|user is deactivated/i.test(r.description ?? ""));
}

/**
 * Рассылка вопроса дня: пропускает тех, кому уже отправили за этот день, отключает ушедших,
 * при лимите Telegram (429) один раз ждёт и повторяет. Между сообщениями пауза (≈ 25 сообщений в секунду).
 */
export async function broadcastDaily(deps: BroadcastDeps): Promise<BroadcastReport> {
  const report: BroadcastReport = { sent: 0, alreadySent: 0, blocked: 0, failed: 0 };
  for (const sub of deps.subscribers) {
    if (sub.lastSentDay === deps.day) {
      report.alreadySent++;
      continue;
    }
    let res = await deps.send(sub.chatId);
    if (!res.ok && res.status === 429) {
      await deps.sleep(Math.min((res.retryAfter ?? 1) * 1000, 30_000));
      res = await deps.send(sub.chatId);
    }
    if (res.ok) {
      await deps.markSent(sub.chatId, deps.day);
      report.sent++;
    } else if (isGone(res)) {
      await deps.deactivate(sub.chatId);
      report.blocked++;
    } else {
      report.failed++;
    }
    await deps.sleep(40);
  }
  return report;
}
