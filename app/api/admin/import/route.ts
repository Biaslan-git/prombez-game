import { and, asc, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized } from "@/lib/admin-auth";
import { getDb } from "@/lib/db/client";
import { areas, questions } from "@/lib/db/schema";
import { parseImportFile } from "@/lib/import";
import { runImport } from "@/lib/import-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Банки с картинками (data URI) весят до ~20 МБ.
const MAX_BODY_BYTES = 40 * 1024 * 1024;
const SLUG_RE = /^[a-z0-9-]{1,40}$/;

/** Без IMPORT_TOKEN эндпоинт «не существует»; с неверным токеном — 401. */
function guard(req: NextRequest): NextResponse | null {
  if (!process.env.IMPORT_TOKEN) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!isAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

const flag = (v: string | null) => v === "1" || v === "true";

/**
 * Импорт банка вопросов: тело — JSON формата из SPEC (раздел 9).
 * POST /api/admin/import?area=a1&version=…&publish=1&dryRun=1
 */
export async function POST(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;

  const params = req.nextUrl.searchParams;
  const slug = params.get("area")?.trim().toLowerCase() ?? "";
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "bad_area", message: "Параметр area: латиница, цифры и дефис" }, { status: 400 });
  }

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const parsed = parseImportFile(json);
  if (parsed.errors.length) {
    return NextResponse.json({ error: "validation_failed", errors: parsed.errors }, { status: 422 });
  }

  const version = params.get("version")?.trim() ?? parsed.area.bank_version ?? "";
  const summary = { area: parsed.area.code, slug, version, questions: parsed.questions.length };

  // dryRun: тот же импорт с откатом транзакции — отчёт показывает, сколько вопросов узнано, добавится и уйдёт.
  const dryRun = flag(params.get("dryRun"));
  const publish = flag(params.get("publish"));
  try {
    const report = await runImport(getDb(), parsed, { slug, version, publish, dryRun });
    if (!dryRun) revalidatePath("/", "layout");
    return NextResponse.json({ dryRun, publish, ...summary, report });
  } catch (err) {
    // 23505 — нарушение уникальности: чаще всего код области уже занят другим slug.
    const pgCode = (err as { cause?: { code?: string } }).cause?.code;
    if (pgCode === "23505") {
      return NextResponse.json(
        {
          error: "conflict",
          message: `Код области «${parsed.area.code}» уже используется другой областью (slug ≠ ${slug})`,
        },
        { status: 409 },
      );
    }
    console.error("import failed", err);
    return NextResponse.json({ error: "import_failed" }, { status: 500 });
  }
}

/** Состояние областей, включая скрытые: чтобы проверить загрузку до публикации. */
export async function GET(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;

  const db = getDb();
  const rows = await db
    .select({
      slug: areas.slug,
      code: areas.code,
      title: areas.title,
      isPublished: areas.isPublished,
      bankVersion: areas.bankVersion,
      bankUpdatedAt: areas.bankUpdatedAt,
      exam: {
        questions: areas.examQuestionsCount,
        timeLimitMin: areas.examTimeLimitMin,
        passThreshold: areas.examPassThreshold,
      },
      activeQuestions: count(questions.id),
    })
    .from(areas)
    .leftJoin(questions, and(eq(questions.areaId, areas.id), eq(questions.isActive, true)))
    .groupBy(areas.id)
    .orderBy(asc(areas.sortOrder), asc(areas.code));
  return NextResponse.json({ areas: rows });
}
