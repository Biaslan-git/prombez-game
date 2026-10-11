import { NextResponse, type NextRequest } from "next/server";
import { searchQuestions } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  try {
    const results = await searchQuestions(q);
    return NextResponse.json({ q, results }, { headers: { "cache-control": "public, max-age=60" } });
  } catch (err) {
    console.error("search failed", err);
    return NextResponse.json({ q, results: [], error: "search_failed" }, { status: 500 });
  }
}
