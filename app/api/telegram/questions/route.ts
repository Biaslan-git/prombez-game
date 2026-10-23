import { NextResponse } from "next/server";
import { getPollCandidates } from "@/lib/data";
import { isPollable } from "@/lib/poll-questions";

export const dynamic = "force-dynamic";

/**
 * Вопросы для бота «Вопрос дня»: канонические вопросы области, подходящие для викторины Telegram.
 * Содержимое то же, что на публичных страницах сайта; используется только генератором bot/tgcloud/lib/questions.js.
 */
export async function GET() {
  const area = process.env.TELEGRAM_AREA || "a1";
  const questions = (await getPollCandidates(area)).filter(isPollable);
  return NextResponse.json(
    { area, count: questions.length, questions },
    { headers: { "cache-control": "public, s-maxage=3600" } },
  );
}
