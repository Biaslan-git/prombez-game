import { timingSafeEqual } from "node:crypto";

/**
 * Проверка служебного токена: `Authorization: Bearer <IMPORT_TOKEN>`.
 * Без IMPORT_TOKEN в окружении административные эндпоинты отключены (всегда false).
 */
export function isAuthorized(authorization: string | null | undefined, token = process.env.IMPORT_TOKEN): boolean {
  if (!token || !authorization) return false;
  const prefix = "Bearer ";
  if (!authorization.startsWith(prefix)) return false;
  const given = Buffer.from(authorization.slice(prefix.length));
  const expected = Buffer.from(token);
  // Разная длина — сразу отказ (timingSafeEqual требует равных длин); длина токена не секрет.
  return given.length === expected.length && timingSafeEqual(given, expected);
}
