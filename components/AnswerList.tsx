"use client";

import type { ClientAnswer } from "@/lib/data";

export type AnswerState = "idle" | "selected" | "correct" | "wrong" | "missed" | "dim";

/** Состояние варианта ответа после проверки (или до неё). */
export function answerState(a: ClientAnswer, selected: readonly number[], revealed: boolean): AnswerState {
  const isSel = selected.includes(a.id);
  if (!revealed) return isSel ? "selected" : "idle";
  if (a.isCorrect) return isSel ? "correct" : "missed";
  return isSel ? "wrong" : "dim";
}

const STYLES: Record<AnswerState, string> = {
  idle: "border-line bg-surface hover:border-brand/60 hover:bg-surface-2",
  selected: "border-brand bg-surface-2 ring-1 ring-brand",
  correct: "border-ok bg-ok-bg",
  missed: "border-ok border-dashed bg-ok-bg",
  wrong: "border-bad bg-bad-bg",
  dim: "border-line bg-surface opacity-70",
};

const MARK: Partial<Record<AnswerState, string>> = { correct: "✓", missed: "✓", wrong: "✗" };

export function AnswerList({
  answers,
  multi,
  selected,
  revealed,
  disabled,
  onChoose,
}: {
  answers: ClientAnswer[];
  multi: boolean;
  selected: readonly number[];
  revealed: boolean;
  disabled?: boolean;
  onChoose: (id: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5" role={multi ? "group" : "radiogroup"} aria-label="Варианты ответа">
      {answers.map((a, i) => {
        const state = answerState(a, selected, revealed);
        const mark = MARK[state];
        return (
          <button
            key={a.id}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={selected.includes(a.id)}
            disabled={disabled || revealed}
            onClick={() => onChoose(a.id)}
            data-state={state}
            className={`flex min-h-12 w-full items-start gap-3 rounded-xl border-2 px-3.5 py-3 text-left transition-colors disabled:cursor-default ${STYLES[state]}`}
          >
            <span
              aria-hidden
              className={`mt-0.5 grid size-6 shrink-0 place-items-center border text-xs font-semibold ${
                multi ? "rounded-md" : "rounded-full"
              } ${state === "selected" ? "border-brand bg-brand text-brand-fg" : "border-line text-muted"}`}
            >
              {mark ?? (multi && selected.includes(a.id) ? "✓" : i + 1)}
            </span>
            <span className="flex-1">{a.text}</span>
            {state === "correct" || state === "missed" ? (
              <span className="sr-only">— правильный ответ</span>
            ) : state === "wrong" ? (
              <span className="sr-only">— неверный ответ</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Explanation({ explanation, normRef }: { explanation: string | null; normRef: string | null }) {
  if (!explanation && !normRef) return null;
  return (
    <div className="mt-4 rounded-xl border border-line bg-surface p-4" data-testid="explanation">
      {explanation && (
        <>
          <div className="mb-1 text-sm font-semibold">Почему так</div>
          <p className="whitespace-pre-line">{explanation}</p>
        </>
      )}
      {normRef && <p className={`text-sm text-muted ${explanation ? "mt-2" : ""}`}>Норма: {normRef}</p>}
    </div>
  );
}
