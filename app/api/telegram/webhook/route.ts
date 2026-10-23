import { NextResponse, type NextRequest } from "next/server";
import { tokensEqual } from "@/lib/admin-auth";
import { getPollCandidates } from "@/lib/data";
import { SITE_URL } from "@/lib/site";
import { callTelegram } from "@/lib/telegram-api";
import { markSent, subscribe, unsubscribe } from "@/lib/tg-subscribers";
import { BOT_TEXTS, buildPollRequest, dayNumber, parseUpdate, pickDailyQuestion } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Вебхук бота «Вопрос дня». Telegram присылает сюда сообщения пользователей;
 * заголовок X-Telegram-Bot-Api-Secret-Token должен совпадать с TELEGRAM_WEBHOOK_SECRET.
 * Всегда отвечаем 200, иначе Telegram будет повторять доставку.
 */
export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !tokensEqual(req.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const update = parseUpdate(await req.json());
    if (update) await handle(update, token);
  } catch (err) {
    console.error("telegram webhook:", err);
  }
  return NextResponse.json({ ok: true });
}

async function sendQuestion(chatId: string, token: string): Promise<boolean> {
  const now = new Date();
  const candidate = pickDailyQuestion(await getPollCandidates(process.env.TELEGRAM_AREA || "a1"), now);
  if (!candidate) {
    await callTelegram("sendMessage", { chat_id: chatId, text: BOT_TEXTS.noQuestion }, token);
    return false;
  }
  const res = await callTelegram("sendPoll", buildPollRequest(candidate, chatId, SITE_URL, now), token);
  return res.ok;
}

async function handle(update: NonNullable<ReturnType<typeof parseUpdate>>, token: string) {
  const { chatId, username, command } = update;
  switch (command) {
    case "start": {
      await subscribe(chatId, username);
      await callTelegram("sendMessage", { chat_id: chatId, text: BOT_TEXTS.welcome }, token);
      // Первый вопрос уходит сразу; день отмечаем, чтобы утренняя рассылка не прислала второй.
      if (await sendQuestion(chatId, token)) await markSent(chatId, dayNumber(new Date()));
      return;
    }
    case "question":
      await sendQuestion(chatId, token);
      return;
    case "stop":
      await unsubscribe(chatId);
      await callTelegram("sendMessage", { chat_id: chatId, text: BOT_TEXTS.stopped }, token);
      return;
    default:
      await callTelegram("sendMessage", { chat_id: chatId, text: BOT_TEXTS.help }, token);
  }
}
