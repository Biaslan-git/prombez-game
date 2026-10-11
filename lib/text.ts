/**
 * Нормализация текста вопросов и ответов при импорте:
 * неразрывные и множественные пробелы, «ёлочки» вместо прямых и «лапок».
 */
export function normalizeText(input: string): string {
  let s = input
    .replace(/[       \t]/g, " ")
    .replace(/[​‌‍﻿]/g, "")
    .replace(/\r\n?/g, "\n");

  s = s.replace(/[‘’‚‛]/g, "'");
  s = s.replace(/[“”„‟″]/g, '"');
  s = pairQuotes(s);

  return s
    .split("\n")
    .map((line) => line.replace(/ {2,}/g, " ").trim())
    .filter((line, i, arr) => line !== "" || (i > 0 && arr[i - 1] !== ""))
    .join("\n")
    .replace(/ +([,.;:!?)])/g, "$1")
    .replace(/\( +/g, "(")
    .replace(/« +/g, "«")
    .replace(/ +»/g, "»")
    .trim();
}

// Прямые кавычки превращаем в «ёлочки» по чётности: открывающая, закрывающая, …
function pairQuotes(s: string): string {
  let open = true;
  return s.replace(/"/g, () => {
    const q = open ? "«" : "»";
    open = !open;
    return q;
  });
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, "") + "…";
}
