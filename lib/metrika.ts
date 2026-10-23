export type Goal =
  | "answer_given"
  | "session_10_done"
  | "exam_started"
  | "exam_finished"
  | "exam_passed"
  | "search_used"
  | "quiz_started"
  | "quiz_done"
  | "share_click"
  | "telegram_click";

declare global {
  interface Window {
    ym?: (id: number, method: string, ...args: unknown[]) => void;
  }
}

export const YM_ID = Number(process.env.NEXT_PUBLIC_YM_ID) || 0;

export function reachGoal(goal: Goal, params?: Record<string, unknown>) {
  if (!YM_ID || typeof window === "undefined") return;
  try {
    window.ym?.(YM_ID, "reachGoal", goal, params);
  } catch {
    // Метрика не должна ломать интерфейс.
  }
}
