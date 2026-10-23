// Ежедневная рассылка вопроса дня. Запускается по расписанию: `tgcloud run endpoints/daily '{}'` (GitHub Actions).
// Публично недоступна: у бота нет Mini App, а запрос без проверенных init data платформа отклоняет.
import { api, db } from "sdk";
import { eq } from "sdk/db";
import { subscribers } from "../schema.js";
import { QUESTIONS } from "../lib/questions.js";
import { buildPoll, dayNumber, pickDailyQuestion } from "../lib/daily.js";

const sleep = (ms) => (typeof setTimeout === "function" ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

// Бот заблокирован пользователем или чат больше не существует.
const isGone = (e) =>
  e.code === 403 || (e.code === 400 && /chat not found|user is deactivated/i.test(e.description ?? ""));

async function sendWithRetry(poll) {
  try {
    await api.sendPoll(poll);
  } catch (e) {
    if (e.code !== 429) throw e;
    await sleep(Math.min((e.parameters?.retry_after ?? 1) * 1000, 10_000));
    await api.sendPoll(poll);
  }
}

export default async function daily() {
  const now = new Date();
  const day = dayNumber(now);
  const q = pickDailyQuestion(QUESTIONS, now);
  if (!q) return { error: "no_question" };

  const subs = await db.select().from(subscribers).where(eq(subscribers.active, true)).all();
  const report = { day, questionId: q.id, subscribers: subs.length, sent: 0, alreadySent: 0, blocked: 0, failed: 0 };
  for (const s of subs) {
    if (s.lastSentDay === day) {
      report.alreadySent++;
      continue;
    }
    try {
      const poll = buildPoll(q, s.chatId, now, undefined, s.lastPos ?? null);
      await sendWithRetry(poll);
      await db
        .update(subscribers)
        .set({ lastSentDay: day, lastPos: poll.correct_option_id })
        .where(eq(subscribers.chatId, s.chatId))
        .run();
      report.sent++;
    } catch (e) {
      if (isGone(e)) {
        await db.update(subscribers).set({ active: false }).where(eq(subscribers.chatId, s.chatId)).run();
        report.blocked++;
      } else {
        console.error("sendPoll failed", s.chatId, e.code, e.description);
        report.failed++;
      }
    }
    await sleep(40);
  }
  return report;
}
