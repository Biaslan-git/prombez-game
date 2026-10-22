"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnswerList, Explanation } from "@/components/AnswerList";
import { ShareButtons } from "@/components/ShareButtons";
import { useAreaProgress } from "@/components/useAreaProgress";
import type { ClientQuestion } from "@/lib/data";
import { isAnswerCorrect, shuffleAnswers } from "@/lib/exam";
import { reachGoal } from "@/lib/metrika";
import { recordAnswer } from "@/lib/progress";
import { QUIZ_ROUND, quizRound } from "@/lib/quiz";
import { pluralRu } from "@/lib/site";

type Props = {
  area: { slug: string; code: string };
  questions: ClientQuestion[];
  topicTitle: string | null;
  /** Адрес страницы, которой делятся (canonical). */
  pageUrl: string;
};

type Phase = "idle" | "quiz" | "done";

/** Мини-тест под страницей вопроса: 5 вопросов, ответы идут в общий прогресс области. */
export function MiniQuiz({ area, questions, topicTitle, pageUrl }: Props) {
  const { update } = useAreaProgress(area.slug);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);

  useEffect(() => setMounted(true), []);

  const items = useMemo(() => quizRound(questions, round), [questions, round]);
  const base = items[index];
  const question = useMemo(
    () => (base ? { ...base, answers: shuffleAnswers(base.answers) } : undefined),
    // Порядок вариантов фиксируем на время показа вопроса.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, round, phase],
  );

  // Без JS блок не показываем: кнопка была бы мёртвой.
  if (!mounted || questions.length === 0) return null;

  const total = items.length;
  const heading = topicTitle ? `Проверьте себя по теме «${topicTitle}»` : "Проверьте себя";

  function start(nextRound: number) {
    setRound(nextRound);
    setIndex(0);
    setSelected([]);
    setRevealed(false);
    setResults([]);
    setPhase("quiz");
    reachGoal("quiz_started", { area: area.code, round: nextRound });
  }

  function submit(ids: number[]) {
    if (!question || revealed || ids.length === 0) return;
    const correct = isAnswerCorrect(question, ids);
    setSelected(ids);
    setRevealed(true);
    setResults((r) => [...r, correct]);
    update((p) => recordAnswer(p, question.id, correct, Date.now()));
    reachGoal("answer_given", { area: area.code, correct, source: "quiz" });
  }

  function onChoose(id: number) {
    if (!question || revealed) return;
    if (question.multi) setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    else submit([id]);
  }

  function next() {
    if (index + 1 >= total) {
      setPhase("done");
      reachGoal("quiz_done", { area: area.code, correct: results.filter(Boolean).length, total });
      return;
    }
    setIndex(index + 1);
    setSelected([]);
    setRevealed(false);
  }

  if (phase === "idle") {
    return (
      <section className="mt-8 rounded-2xl border border-line bg-surface p-5" data-testid="mini-quiz">
        <h2 className="text-lg font-semibold">{heading}</h2>
        <p className="mt-1 text-sm text-muted">
          {Math.min(QUIZ_ROUND, questions.length)} коротких вопросов без регистрации. Ответы засчитываются в вашу
          готовность по области {area.code}.
        </p>
        <button type="button" onClick={() => start(0)} className="btn-primary mt-4 w-full sm:w-auto">
          Начать мини-тест
        </button>
      </section>
    );
  }

  if (phase === "done") {
    const correct = results.filter(Boolean).length;
    const shareText = `Я ответил на ${correct} из ${total} ${pluralRu(total, "вопрос", "вопроса", "вопросов")}${
      topicTitle ? ` по теме «${topicTitle}»` : ""
    } из банка Ростехнадзора. Проверь себя:`;
    const hasMore = questions.length > total;
    return (
      <section className="mt-8 rounded-2xl border border-line bg-surface p-5" data-testid="mini-quiz">
        <h2 className="text-lg font-semibold">Результат</h2>
        <p className="mt-1 text-2xl font-bold" data-testid="quiz-score">
          {correct} из {total} верно
        </p>
        <p className="mt-1 text-sm text-muted">
          {correct === total
            ? "Отлично! Попробуйте ещё несколько вопросов."
            : "Ошибки вернутся в тренировке для повторения."}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {hasMore && (
            <button type="button" onClick={() => start(round + 1)} className="btn-secondary">
              Ещё {Math.min(QUIZ_ROUND, questions.length - total)} вопросов
            </button>
          )}
          <Link href={`/${area.slug}/train`} className="btn-primary">
            Тренировать область {area.code}
          </Link>
        </div>
        <div className="mt-4">
          <ShareButtons url={pageUrl} text={shareText} where="quiz" />
        </div>
      </section>
    );
  }

  if (!question) return null;
  const correctNow = revealed && isAnswerCorrect(question, selected);
  return (
    <section className="mt-8 rounded-2xl border border-line bg-surface p-5" data-testid="mini-quiz" aria-live="polite">
      <div className="mb-2 flex items-center justify-between text-sm text-muted">
        <span>{heading}</span>
        <span className="tabular-nums">
          {index + 1} / {total}
        </span>
      </div>
      <h2 className="mb-4 text-lg font-semibold leading-snug">{question.text}</h2>
      <AnswerList
        answers={question.answers}
        multi={question.multi}
        selected={selected}
        revealed={revealed}
        onChoose={onChoose}
      />
      {question.multi && !revealed && (
        <button
          type="button"
          onClick={() => submit(selected)}
          disabled={selected.length === 0}
          className="btn-primary mt-4 w-full disabled:opacity-50"
        >
          Ответить
        </button>
      )}
      {revealed && (
        <>
          <p className={`mt-4 text-lg font-semibold ${correctNow ? "text-ok" : "text-bad"}`} data-testid="quiz-verdict">
            {correctNow ? "Верно!" : "Неверно"}
          </p>
          <Explanation explanation={question.explanation} normRef={question.normRef} />
          <button type="button" onClick={next} className="btn-primary mt-4 w-full" autoFocus>
            {index + 1 >= total ? "Показать результат" : "Дальше"}
          </button>
        </>
      )}
    </section>
  );
}
