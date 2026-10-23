export type TgResult = { ok: true } | { ok: false; status: number; description?: string; retryAfter?: number };

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

/** Вызов метода Bot API. fetch можно подменить в тестах. */
export async function callTelegram(
  method: string,
  body: unknown,
  token: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<TgResult> {
  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      parameters?: { retry_after?: number };
    };
    if (res.ok && data.ok) return { ok: true };
    return { ok: false, status: res.status, description: data.description, retryAfter: data.parameters?.retry_after };
  } catch (err) {
    return { ok: false, status: 0, description: (err as Error).message };
  }
}
