"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdSlot } from "@/components/AdSlot";
import { AnswerList, Explanation } from "@/components/AnswerList";
import { ReadinessBar } from "@/components/Readiness";
import { useAreaProgress } from "@/components/useAreaProgress";
import { useAnswerHotkeys } from "@/components/useHotkeys";
import type { ClientQuestion } from "@/lib/data";
import { isAnswerCorrect, shuffleAnswers } from "@/lib/exam";
import { reachGoal } from "@/lib/metrika";
import {
  areaStats,
  emptySession,
  mistakeIds,
  pickNext,
  pickNextMistake,
  recordAnswer,
  recordInSession,
  type AreaProgress,
  type PickReason,
  type SessionState,
} from "@/lib/progress";
import { FEEDBACK_EMAIL, absoluteUrl } from "@/lib/site";

const BLOCK = 10;

type Props = {
  area: { slug: string; code: string };
  questions: ClientQuestion[];
  mode?: "all" | "mistakes";
};

type Current = { id: number; reason: PickReason | "mistake" };
type Summary = { correct: number; total: number; delta: number };

export function Trainer({ area, questions, mode = "all" }: Props) {
  const { progress, update } = useAreaProgress(area.slug);
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const orderedIds = useMemo(() => questions.map((q) => q.id), [questions]);

  const [session, setSession] = useState<SessionState>(emptySession);
  const [current, setCurrent] = useState<Current | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [block, setBlock] = useState({ correct: 0, startReadiness: 0 });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [mistakeSnapshot, setMistakeSnapshot] = useState<number[] | null>(null);
  const [solved, setSolved] = useState<Set<number>>(() => new Set());
  const [finished, setFinished] = useState(false);

  const stats = progress ? areaStats(progress, orderedIds) : null;

  function choose(p: AreaProgress, s: SessionState, solvedSet: Set<number>, snapshot: number[] | null): Current | null {
    if (mode === "mistakes") {
      const id = pickNextMistake(snapshot ?? [], p, s, solvedSet);
      return id === null ? null : { id, reason: "mistake" };
    }
    return pickNext(orderedIds, p, s, Date.now());
  }

  // Первый вопрос — после загрузки прогресса из хранилища.
  useEffect(() => {
    if (!progress || current || finished) return;
    let snapshot = mistakeSnapshot;
    if (mode === "mistakes" && !snapshot) {
      snapshot = mistakeIds(progress, orderedIds);
      setMistakeSnapshot(snapshot);
    }
    const next = choose(progress, session, solved, snapshot);
    if (next) setCurrent(next);
    else setFinished(true);
    setBlock((b) =>
      session.answered === 0 ? { correct: 0, startReadiness: areaStats(progress, orderedIds).readiness } : b,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, current, finished]);

  const baseQuestion = current ? byId.get(current.id) : undefined;
  // Порядок вариантов случайный при каждом показе, чтобы запоминалось содержание, а не позиция ответа.
  const question = useMemo(
    () => (baseQuestion ? { ...baseQuestion, answers: shuffleAnswers(baseQuestion.answers) } : undefined),
    // current — новый объект при каждом выборе вопроса, поэтому повтор того же вопроса перемешивается заново.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseQuestion, current],
  );

  function submit(ids: number[]) {
    if (!question || revealed || ids.length === 0) return;
    const correct = isAnswerCorrect(question, ids);
    setSelected(ids);
    setRevealed(true);
    const nextProgress = update((p) => recordAnswer(p, question.id, correct, Date.now()));
    const nextSession = recordInSession(session, question.id, correct);
    setSession(nextSession);
    if (correct) setSessionCorrect((c) => c + 1);
    if (mode === "mistakes" && correct) setSolved((s) => new Set(s).add(question.id));
    reachGoal("answer_given", { area: area.code, correct });

    const blockCorrect = block.correct + (correct ? 1 : 0);
    if (nextSession.answered % BLOCK === 0) {
      const now = areaStats(nextProgress, orderedIds).readiness;
      setSummary({ correct: blockCorrect, total: BLOCK, delta: now - block.startReadiness });
      setBlock({ correct: 0, startReadiness: now });
      reachGoal("session_10_done", { area: area.code, correct: blockCorrect });
    } else {
      setBlock({ ...block, correct: blockCorrect });
    }
  }

  function onChoose(id: number) {
    if (!question || revealed) return;
    if (question.multi) setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    else submit([id]);
  }

  function goNext() {
    if (!revealed || !progress) return;
    const next = choose(progress, session, solved, mistakeSnapshot);
    setSelected([]);
    setRevealed(false);
    setSummary(null);
    if (next) setCurrent(next);
    else {
      setCurrent(null);
      setFinished(true);
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }

  useAnswerHotkeys({
    onDigit: (i) => {
      const a = question?.answers[i];
      if (a) onChoose(a.id);
    },
    onEnter: () => {
      if (revealed) goNext();
      else if (question?.multi) submit(selected);
    },
  });

  const header = (
    <div className="mb-5">
      <ReadinessBar value={stats?.readiness ?? null} compact />
      <div className="mt-2 flex items-center justify-between text-sm text-muted">
        <span>
          Готовность <b className="text-fg tabular-nums">{stats ? `${stats.readiness}%` : "—"}</b>
        </span>
        <span className="tabular-nums">
          В сессии: {session.answered} · верно {sessionCorrect}
        </span>
      </div>
    </div>
  );

  if (!progress) {
    return (
      <div aria-busy="true">
        {header}
        <div className="h-40 animate-pulse rounded-xl bg-surface-2" />
      </div>
    );
  }

  if (questions.length === 0) {
    return <p className="text-muted">В этой области пока нет вопросов.</p>;
  }

  if (finished || !question) {
    return (
      <div>
        {header}
        {mode === "mistakes" ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center">
            <p className="text-2xl font-semibold">{session.answered ? "Ошибки разобраны 💪" : "Ошибок нет 🎉"}</p>
            <p className="mt-2 text-muted">Проверьте себя в формате реального экзамена.</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link href={`/${area.slug}/exam`} className="btn-primary">
                Пройти экзамен
              </Link>
              <Link href={`/${area.slug}/train`} className="btn-secondary">
                Тренировка
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-muted">Вопросы закончились.</p>
        )}
      </div>
    );
  }

  const correctNow = revealed && isAnswerCorrect(question, selected);
  const reportHref = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
    `Ошибка в вопросе ${area.code} №${question.number}`,
  )}&body=${encodeURIComponent(`Вопрос: ${absoluteUrl(`/${area.slug}/q/${question.slug}`)}\n\nЧто не так:\n`)}`;

  return (
    <div className="pb-24 sm:pb-0">
      {header}

      {current?.reason === "ahead" && (
        <p className="mb-4 rounded-xl bg-warn-bg px-4 py-3 text-sm">
          На сегодня всё повторено 💪 Можно закрепить вопросы заранее.
        </p>
      )}
      {mode === "mistakes" && mistakeSnapshot && (
        <p className="mb-3 text-sm text-muted">
          Работа над ошибками: осталось {mistakeSnapshot.length - solved.size} из {mistakeSnapshot.length}
        </p>
      )}

      <article>
        <div className="mb-2 text-sm text-muted">
          Вопрос №{question.number}
          {current?.reason === "repeat" && " · повтор ошибки"}
          {question.multi && " · несколько правильных ответов"}
        </div>
        <h1 className="mb-5 text-lg font-semibold leading-snug sm:text-xl">{question.text}</h1>

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
          <div aria-live="polite">
            <p className={`mt-4 text-lg font-semibold ${correctNow ? "text-ok" : "text-bad"}`} data-testid="verdict">
              {correctNow ? "Верно!" : "Неверно"}
            </p>
            <Explanation explanation={question.explanation} normRef={question.normRef} />
          </div>
        )}
      </article>

      {revealed && summary && (
        <section className="mt-6 rounded-2xl border border-line bg-surface p-5" aria-label="Итог мини-сессии">
          <p className="text-lg font-semibold">
            {summary.correct} из {summary.total} верно
            {summary.delta !== 0 && `, готовность ${summary.delta > 0 ? "+" : ""}${summary.delta}%`}
          </p>
          <p className="text-sm text-muted">Так держать — короткие подходы работают лучше всего.</p>
          <AdSlot id="train" minHeight={200} className="mb-0" />
        </section>
      )}

      {revealed && (
        <div className="fixed inset-x-0 bottom-[var(--cookie-h,0px)] z-30 border-t border-line bg-surface/95 p-3 backdrop-blur sm:static sm:mt-5 sm:border-0 sm:bg-transparent sm:p-0">
          <button type="button" onClick={goNext} className="btn-primary w-full" autoFocus>
            Дальше
          </button>
        </div>
      )}

      <p className="mt-8 text-center text-sm">
        <a href={reportHref} className="text-muted underline hover:text-fg">
          Сообщить об ошибке в вопросе
        </a>
      </p>
    </div>
  );
}
