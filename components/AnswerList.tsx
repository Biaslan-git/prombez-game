"use client";

import type { ClientAnswer } from "@/lib/data";
import { isSequenceKind, sequenceKey, solutionOrder, splitPair, type QuestionKind } from "@/lib/question-kind";

type KindInfo = { kind: QuestionKind; multi: boolean; answers: readonly unknown[] };

/** Нужна ли кнопка «Ответить» (иначе ответ — первый же клик). */
export function needsSubmit(q: KindInfo): boolean {
  return q.multi || isSequenceKind(q.kind);
}

/** Можно ли отправить ответ: в вопросах на порядок и соответствие нужно расставить все варианты. */
export function canSubmit(q: KindInfo, selected: readonly number[]): boolean {
  return isSequenceKind(q.kind) ? selected.length === q.answers.length : selected.length > 0;
}

/** Выбор варианта: в одиночном вопросе — замена, в остальных — добавить/убрать (порядок кликов важен). */
export function toggleChoice(q: KindInfo, selected: readonly number[], id: number): number[] {
  if (!needsSubmit(q)) return [id];
  return selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
}

export function kindHint(q: KindInfo): string | null {
  if (q.kind === "order") return "расставьте варианты по порядку";
  if (q.kind === "match") return "сопоставьте";
  return q.multi ? "несколько правильных ответов" : null;
}

export function QuestionImage({ src }: { src: string | null }) {
  if (!src) return null;
  return (
    // Картинки из банка вопросов разного размера, оптимизировать их через next/image незачем.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Рисунок к вопросу"
      loading="lazy"
      className="mb-5 max-h-[70vh] w-auto max-w-full rounded-xl border border-line bg-white"
    />
  );
}

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
  kind = "choice",
  selected,
  revealed,
  disabled,
  onChoose,
}: {
  answers: ClientAnswer[];
  multi: boolean;
  kind?: QuestionKind;
  selected: readonly number[];
  revealed: boolean;
  disabled?: boolean;
  onChoose: (id: number) => void;
}) {
  if (isSequenceKind(kind)) {
    return (
      <SequenceList
        kind={kind}
        answers={answers}
        selected={selected}
        revealed={revealed}
        disabled={disabled}
        onChoose={onChoose}
      />
    );
  }
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

/**
 * Вопрос на порядок или соответствие: варианты нажимают по очереди, на каждом — его место. Повторное нажатие убирает
 * вариант. В соответствии сверху стоят левые части пар, а нажимаются правые: N-й выбранный вариант встаёт к N-й левой.
 */
function SequenceList({
  kind,
  answers,
  selected,
  revealed,
  disabled,
  onChoose,
}: {
  kind: "order" | "match";
  answers: ClientAnswer[];
  selected: readonly number[];
  revealed: boolean;
  disabled?: boolean;
  onChoose: (id: number) => void;
}) {
  const solution = solutionOrder(answers);
  const byId = new Map(answers.map((a) => [a.id, a]));
  const label = (a: ClientAnswer) => (kind === "match" ? (splitPair(a.text)?.[1] ?? a.text) : a.text);
  const placedRight = (place: number) => {
    const a = byId.get(selected[place]!);
    return !!a && sequenceKey(kind, a.text) === sequenceKey(kind, solution[place]!.text);
  };

  return (
    <div className="flex flex-col gap-4">
      {kind === "match" && (
        <ol className="flex flex-col gap-2" aria-label="Что сопоставить">
          {solution.map((a, i) => {
            const chosen = selected[i] !== undefined ? byId.get(selected[i]!) : undefined;
            const ok = revealed && placedRight(i);
            return (
              <li key={a.id} className="rounded-xl border border-line bg-surface-2 px-3.5 py-2.5">
                <div>
                  <b className="tabular-nums">{i + 1}.</b> {splitPair(a.text)?.[0] ?? a.text}
                </div>
                <div className={`mt-1 text-sm ${revealed ? (ok ? "text-ok" : "text-bad") : "text-muted"}`}>
                  → {chosen ? label(chosen) : "…"}
                  {revealed && !ok && <span className="text-ok"> (верно: {label(a)})</span>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex flex-col gap-2.5" role="group" aria-label="Варианты ответа">
        {answers.map((a, i) => {
          const place = selected.indexOf(a.id);
          const correctPlace = solution.findIndex((s) => sequenceKey(kind, s.text) === sequenceKey(kind, a.text));
          const state: AnswerState = !revealed
            ? place >= 0
              ? "selected"
              : "idle"
            : place >= 0 && placedRight(place)
              ? "correct"
              : "wrong";
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={place >= 0}
              disabled={disabled || revealed}
              onClick={() => onChoose(a.id)}
              data-state={state}
              className={`flex min-h-12 w-full items-start gap-3 rounded-xl border-2 px-3.5 py-3 text-left transition-colors disabled:cursor-default ${STYLES[state]}`}
            >
              <span
                aria-hidden
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border text-xs font-semibold ${
                  place >= 0 ? "border-brand bg-brand text-brand-fg" : "border-line text-muted"
                }`}
              >
                {place >= 0 ? place + 1 : "·"}
              </span>
              <span className="flex-1">
                {kind === "order" && <span className="sr-only">Вариант {i + 1}: </span>}
                {label(a)}
                {revealed && state === "wrong" && (
                  <span className="ml-2 text-sm text-ok">
                    {kind === "order" ? `верное место: ${correctPlace + 1}` : `к пункту ${correctPlace + 1}`}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {!revealed && (
        <p className="text-sm text-muted">
          {kind === "order"
            ? `Нажимайте варианты по порядку: первым — то, что идёт первым. Выбрано ${selected.length} из ${answers.length}.`
            : `Нажимайте варианты по порядку пунктов 1, 2, 3… Выбрано ${selected.length} из ${answers.length}.`}
        </p>
      )}
    </div>
  );
}
