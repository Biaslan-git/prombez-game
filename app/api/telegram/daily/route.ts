import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized } from "@/lib/admin-auth";
import { getPollCandidates } from "@/lib/data";
import { SITE_URL } from "@/lib/site";
import { callTelegram } from "@/lib/telegram-api";
import { broadcastDaily } from "@/lib/telegram-broadcast";
import { deactivate, listActive, markSent } from "@/lib/tg-subscribers";
import { buildPollRequest, dayNumber, pickDailyQuestion } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Защита от двойного запуска за сутки для канала (для подписчиков бота — last_sent_day в БД).
let lastChannelDay = -1;

/**
 * Ежедневная рассылка «вопроса дня» подписчикам бота (и в канал, если задан TELEGRAM_CHAT_ID). Вызывается по расписанию.
 *   POST /api/telegram/daily            — отправить
 *   POST /api/telegram/daily?dryRun=1   — показать запрос и число подписчиков, ничего не отправляя
 * Авторизация: `Authorization: Bearer <CRON_TOKEN>`.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req.headers.get("authorization"), process.env.CRON_TOKEN)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!dryRun && !token) return NextResponse.json({ error: "telegram_not_configured" }, { status: 503 });

  const now = new Date();
  const candidate = pickDailyQuestion(await getPollCandidates(process.env.TELEGRAM_AREA || "a1"), now);
  if (!candidate) return NextResponse.json({ error: "no_question" }, { status: 404 });
  const subscribers = await listActive();
  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      subscribers: subscribers.length,
      poll: buildPollRequest(candidate, "<chat_id>", SITE_URL, now),
    });
  }

  const day = dayNumber(now);
  const report = await broadcastDaily({
    subscribers,
    day,
    send: (chatId) => callTelegram("sendPoll", buildPollRequest(candidate, chatId, SITE_URL, now), token!),
    markSent,
    deactivate,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  });

  let channel: string | undefined;
  const channelId = process.env.TELEGRAM_CHAT_ID;
  if (channelId && day !== lastChannelDay) {
    const res = await callTelegram("sendPoll", buildPollRequest(candidate, channelId, SITE_URL, now), token!);
    if (res.ok) lastChannelDay = day;
    channel = res.ok ? "sent" : `failed: ${res.description ?? res.status}`;
  }
  return NextResponse.json({ ok: true, questionId: candidate.id, ...report, channel });
}
