import { NextResponse, type NextRequest } from "next/server";
import { getPollCandidates } from "@/lib/data";
import { isPollable } from "@/lib/poll-questions";

export const dynamic = "force-dynamic";

/**
 * Вопросы для бота «Вопрос дня»: вопросы области (?area=slug), подходящие для викторины Telegram.
 * Содержимое то же, что на публичных страницах сайта; используется только синхронизацией бота (scripts/sync-bot.mjs).
 */
export async function GET(req: NextRequest) {
  const area = req.nextUrl.searchParams.get("area") || process.env.TELEGRAM_AREA || "a1";
  const questions = (await getPollCandidates(area)).filter(isPollable);
  return NextResponse.json(
    { area, count: questions.length, questions },
    { headers: { "cache-control": "public, s-maxage=3600" } },
  );
}
