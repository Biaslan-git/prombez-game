export type AdPlacement = "home" | "area" | "train" | "question" | "questionBottom";

// Литеральные обращения к process.env: Next подставляет NEXT_PUBLIC_* при сборке.
const BLOCKS: Record<AdPlacement, string | undefined> = {
  home: process.env.NEXT_PUBLIC_RSYA_BLOCK_HOME,
  area: process.env.NEXT_PUBLIC_RSYA_BLOCK_AREA,
  train: process.env.NEXT_PUBLIC_RSYA_BLOCK_TRAIN,
  question: process.env.NEXT_PUBLIC_RSYA_BLOCK_QUESTION,
  questionBottom: process.env.NEXT_PUBLIC_RSYA_BLOCK_QUESTION_BOTTOM,
};

export const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";

/** ID блока РСЯ или null, если реклама выключена или блок не настроен. */
export function adBlockId(placement: AdPlacement): string | null {
  if (!ADS_ENABLED) return null;
  return BLOCKS[placement]?.trim() || null;
}
