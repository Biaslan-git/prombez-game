import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized } from "@/lib/admin-auth";
import { getPollCandidates } from "@/lib/data";
import { SITE_URL } from "@/lib/site";
import { buildPollRequest, dayNumber, pickDailyQuestion } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Защита от двойного запуска за сутки в пределах одного процесса.
let lastPostedDay = -1;

/**
 * «Вопрос дня» в Telegram-канал: quiz-опрос с кнопкой на разбор. Вызывается по расписанию.
 *   POST /api/telegram/daily            — отправить
 *   POST /api/telegram/daily?dryRun=1   — показать запрос, ничего не отправляя
 * Авторизация: `Authorization: Bearer <CRON_TOKEN>`.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req.headers.get("authorization"), process.env.CRON_TOKEN)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!dryRun && (!token || !chatId)) {
    return NextResponse.json({ error: "telegram_not_configured" }, { status: 503 });
  }

  const now = new Date();
  const candidate = pickDailyQuestion(await getPollCandidates(process.env.TELEGRAM_AREA || "a1"), now);
  if (!candidate) return NextResponse.json({ error: "no_question" }, { status: 404 });
  const poll = buildPollRequest(candidate, chatId || "@dry-run", SITE_URL, now);
  if (dryRun) return NextResponse.json({ dryRun: true, poll });

  const day = dayNumber(now);
  if (day === lastPostedDay) return NextResponse.json({ skipped: "already_posted_today" });

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPoll`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(poll),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!res.ok || !data.ok) {
    return NextResponse.json(
      { error: "telegram_failed", status: res.status, description: data.description },
      { status: 502 },
    );
  }
  lastPostedDay = day;
  return NextResponse.json({ ok: true, questionId: candidate.id, slug: candidate.slug });
}
