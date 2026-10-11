const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function transliterate(input: string): string {
  return Array.from(input.toLowerCase())
    .map((ch) => MAP[ch] ?? ch)
    .join("");
}

/** Слаг вопроса: `{number}-{транслит первых ~8 слов}`. */
export function questionSlug(number: number, text: string, maxWords = 8): string {
  const words = transliterate(text)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, maxWords);
  const tail = words.join("-").slice(0, 80).replace(/-+$/, "");
  return tail ? `${number}-${tail}` : String(number);
}

/** «А.1» → «a1», «Б.9» → «b9». */
export function areaSlugFromCode(code: string): string {
  return transliterate(code).replace(/[^a-z0-9]+/g, "");
}
