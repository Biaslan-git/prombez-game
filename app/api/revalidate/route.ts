import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

/** Сброс ISR-кэша всех страниц после импорта новой версии банка. */
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ revalidated: true });
}
