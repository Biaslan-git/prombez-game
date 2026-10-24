/**
 * Типы вопросов:
 *  - choice — выбрать один или несколько вариантов (обычный вопрос);
 *  - order — расставить варианты по порядку («Установите последовательность…»), варианты хранятся в правильном порядке;
 *  - match — сопоставить: вариант «левое --- правое», хранятся в правильных парах.
 * В order и match все варианты помечены верными, а ответ — последовательность выбранных вариантов.
 */
export const QUESTION_KINDS = ["choice", "order", "match"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export function isSequenceKind(kind: string | undefined): kind is "order" | "match" {
  return kind === "order" || kind === "match";
}

/** Разделитель пары в вопросе на соответствие. В исходных текстах встречается «---», реже « - ». */
const PAIR_RE = /\s*-{3,}\s*|\s+[-–—]\s+/;
const STRICT_PAIR_RE = /\s*-{3,}\s*/;

/** «Левое --- правое» → [левое, правое]; null, если разделителя нет. */
export function splitPair(text: string): [string, string] | null {
  const m = STRICT_PAIR_RE.exec(text) ?? PAIR_RE.exec(text);
  if (!m) return null;
  const left = text.slice(0, m.index).trim();
  const right = text.slice(m.index + m[0].length).trim();
  return left && right ? [left, right] : null;
}

/** Каноничная запись пары при импорте: «левое --- правое». */
export function joinPair(left: string, right: string): string {
  return `${left} --- ${right}`;
}

export type SeqAnswer = { id: number; text: string; position?: number };

/** Ключ варианта, по которому сравнивается последовательность: в match — правая часть (она бывает одинаковой у разных пар). */
export function sequenceKey(kind: "order" | "match", text: string): string {
  return kind === "match" ? (splitPair(text)?.[1] ?? text) : text;
}

/** Варианты в правильном порядке (по position, а если его нет — как пришли). */
export function solutionOrder<A extends SeqAnswer>(answers: readonly A[]): A[] {
  return answers.every((a) => typeof a.position === "number")
    ? [...answers].sort((a, b) => a.position! - b.position!)
    : [...answers];
}

/**
 * Верна ли последовательность: выбраны все варианты, и на каждом месте стоит вариант с тем же ключом, что в решении.
 * Сравниваем ключи, а не id: в match одинаковые правые части взаимозаменяемы.
 */
export function isSequenceCorrect(
  kind: "order" | "match",
  answers: readonly SeqAnswer[],
  selected: readonly number[],
): boolean {
  if (selected.length !== answers.length) return false;
  const byId = new Map(answers.map((a) => [a.id, a]));
  const solution = solutionOrder(answers);
  return selected.every((id, i) => {
    const a = byId.get(id);
    return !!a && sequenceKey(kind, a.text) === sequenceKey(kind, solution[i]!.text);
  });
}
