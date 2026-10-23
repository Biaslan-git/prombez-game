import { describe, expect, it, vi } from "vitest";
import type { TgResult } from "./telegram-api";
import { broadcastDaily, type BroadcastDeps } from "./telegram-broadcast";

function deps(send: (id: string) => Promise<TgResult>, subs: BroadcastDeps["subscribers"]) {
  const markSent = vi.fn(async () => {});
  const deactivate = vi.fn(async () => {});
  const sleep = vi.fn(async () => {});
  return {
    d: { subscribers: subs, day: 100, send, markSent, deactivate, sleep } satisfies BroadcastDeps,
    markSent,
    deactivate,
    sleep,
  };
}

describe("broadcastDaily", () => {
  it("отправляет новым и отмечает день; уже получившим не шлёт", async () => {
    const send = vi.fn(async () => ({ ok: true }) as TgResult);
    const { d, markSent } = deps(send, [
      { chatId: "1", lastSentDay: 99 },
      { chatId: "2", lastSentDay: 100 },
    ]);
    const r = await broadcastDaily(d);
    expect(r).toEqual({ sent: 1, alreadySent: 1, blocked: 0, failed: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(markSent).toHaveBeenCalledWith("1", 100);
  });

  it("отключает подписчика, заблокировавшего бота (403)", async () => {
    const send = vi.fn(
      async () => ({ ok: false, status: 403, description: "Forbidden: bot was blocked by the user" }) as TgResult,
    );
    const { d, deactivate, markSent } = deps(send, [{ chatId: "5", lastSentDay: null }]);
    const r = await broadcastDaily(d);
    expect(r.blocked).toBe(1);
    expect(deactivate).toHaveBeenCalledWith("5");
    expect(markSent).not.toHaveBeenCalled();
  });

  it("при 429 ждёт retry_after и повторяет один раз", async () => {
    const send = vi
      .fn<(id: string) => Promise<TgResult>>()
      .mockResolvedValueOnce({ ok: false, status: 429, retryAfter: 2 })
      .mockResolvedValueOnce({ ok: true });
    const { d, sleep } = deps(send, [{ chatId: "7", lastSentDay: null }]);
    const r = await broadcastDaily(d);
    expect(r.sent).toBe(1);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("прочие ошибки считает сбоем и не отключает", async () => {
    const send = vi.fn(async () => ({ ok: false, status: 500 }) as TgResult);
    const { d, deactivate } = deps(send, [{ chatId: "9", lastSentDay: null }]);
    expect((await broadcastDaily(d)).failed).toBe(1);
    expect(deactivate).not.toHaveBeenCalled();
  });
});
