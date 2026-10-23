import { and, eq } from "drizzle-orm";
import { getDb } from "./db/client";
import { tgSubscribers } from "./db/schema";
import type { Subscriber } from "./telegram-broadcast";

export async function subscribe(chatId: string, username: string | null): Promise<void> {
  await getDb()
    .insert(tgSubscribers)
    .values({ chatId: Number(chatId), username, active: true })
    .onConflictDoUpdate({ target: tgSubscribers.chatId, set: { active: true, username } });
}

/** /stop: данные подписчика удаляются целиком. */
export async function unsubscribe(chatId: string): Promise<void> {
  await getDb()
    .delete(tgSubscribers)
    .where(eq(tgSubscribers.chatId, Number(chatId)));
}

export async function deactivate(chatId: string): Promise<void> {
  await getDb()
    .update(tgSubscribers)
    .set({ active: false })
    .where(eq(tgSubscribers.chatId, Number(chatId)));
}

export async function markSent(chatId: string, day: number): Promise<void> {
  await getDb()
    .update(tgSubscribers)
    .set({ lastSentDay: day })
    .where(eq(tgSubscribers.chatId, Number(chatId)));
}

export async function listActive(): Promise<Subscriber[]> {
  const rows = await getDb()
    .select({ chatId: tgSubscribers.chatId, lastSentDay: tgSubscribers.lastSentDay })
    .from(tgSubscribers)
    .where(and(eq(tgSubscribers.active, true)));
  return rows.map((r) => ({ chatId: String(r.chatId), lastSentDay: r.lastSentDay }));
}
