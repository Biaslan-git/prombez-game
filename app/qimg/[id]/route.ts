import { NextResponse, type NextRequest } from "next/server";
import { getQuestionImage } from "@/lib/data";

export const runtime = "nodejs";

/** Картинка к вопросу. Адрес содержит хэш (?v=…), поэтому кэшируем надолго. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new NextResponse(null, { status: 404 });
  const img = await getQuestionImage(id);
  if (!img) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(img.data, "base64"), {
    headers: {
      "content-type": img.mime,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
