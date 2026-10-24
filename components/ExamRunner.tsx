"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnswerList, Explanation, QuestionImage, kindHint, toggleChoice } from "@/components/AnswerList";
import { ShareButtons } from "@/components/ShareButtons";
import { useAreaProgress } from "@/components/useAreaProgress";
import { useAnswerHotkeys } from "@/components/useHotkeys";
import type { ClientAnswer, ClientQuestion } from "@/lib/data";
import {
  formatClock,
  generateTicket,
  remainingMs,
  scoreExam,
  type ExamResult,
  type Responses,
  type Ticket,
} from "@/lib/exam";
import { reachGoal } from "@/lib/metrika";
import { recordExam } from "@/lib/progress";
import { absoluteUrl, pluralRu } from "@/lib/site";

type Props = {
  area: { slug: string; code: string; title: string };
  questions: ClientQuestion[];
  config: { count: number; timeLimitMin: number; passThreshold: number };
};

/** Незавершённый экзамен хранится локально, чтобы перезагрузка страницы его не сбрасывала. */
type Saved = {
  v: 1;
  startedAt: number;
  timeLimitMs: number;
  passThreshold: number;
  order: { id: number; answers: number[] }[];
  responses: Responses;
  index: number;
};

const savedKey = (slug: string) => `pg:v1:exam:${slug}`;

function loadSaved(slug: string): Saved | null {
  try {
    const raw = localStorage.getItem(savedKey(slug));
    const s = raw ? (JSON.parse(raw) as Saved) : null;
    return s && s.v === 1 && Array.isArray(s.order) ? s : null;
  } catch {
    return null;
  }
}

function writeSaved(slug: string, s: Saved | null) {
  try {
    if (s) localStorage.setItem(savedKey(slug), JSON.stringify(s));
    else localStorage.removeItem(savedKey(slug));
  } catch {}
}

function ticketFromSaved(s: Saved, byId: Map<number, ClientQuestion>): Ticket<ClientQuestion> | null {
  const qs: ClientQuestion[] = [];
  for (const o of s.order) {
    const q = byId.get(o.id);
    if (!q) return null; // банк обновился — билет недействителен
    const answers = o.answers.map((id) => q.answers.find((a) => a.id === id)).filter((a): a is ClientAnswer => !!a);
    if (answers.length !== q.answers.length) return null;
    qs.push({ ...q, answers });
  }
  return { questions: qs, startedAt: s.startedAt, timeLimitMs: s.timeLimitMs, passThreshold: s.passThreshold };
}

export function ExamRunner({ area, questions, config }: Props) {
  const { update } = useAreaProgress(area.slug);
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  const [ready, setReady] = useState(false);
  const [ticket, setTicket] = useState<Ticket<ClientQuestion> | null>(null);
  const [responses, setResponses] = useState<Responses>({});
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [result, setResult] = useState<ExamResult<ClientQuestion> | null>(null);
  const [confirming, setConfirming] = useState(false);
  const finishedRef = useRef(false);

  const finish = useCallback(
    (t: Ticket<ClientQuestion>, r: Responses) => {
      // Таймер и кнопка могут сработать одновременно — результат записываем один раз.
      if (finishedRef.current) return;
      finishedRef.current = true;
      const res = scoreExam(t, r);
      const at = Date.now();
      update((p) => recordExam(p, res.perQuestion, { at, correct: res.correct, total: res.total, passed: res.passed }));
      writeSaved(area.slug, null);
      setResult(res);
      setConfirming(false);
      reachGoal("exam_finished", { area: area.code, correct: res.correct, total: res.total });
      if (res.passed) reachGoal("exam_passed", { area: area.code });
      window.scrollTo({ top: 0 });
    },
    [area.code, area.slug, update],
  );

  // Восстановление незавершённого экзамена.
  useEffect(() => {
    const saved = loadSaved(area.slug);
    const t = saved ? ticketFromSaved(saved, byId) : null;
    if (saved && t) {
      if (remainingMs(t, Date.now()) <= 0) finish(t, saved.responses);
      else {
        setTicket(t);
        setResponses(saved.responses);
        setIndex(Math.min(saved.index, t.questions.length - 1));
      }
    } else if (saved) writeSaved(area.slug, null);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Таймер; по истечении времени экзамен завершается автоматически.
  useEffect(() => {
    if (!ticket || result) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (remainingMs(ticket, t) <= 0) finish(ticket, responses);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [ticket, result, responses, finish]);

  useEffect(() => {
    if (!ticket || result) return;
    writeSaved(area.slug, {
      v: 1,
      startedAt: ticket.startedAt,
      timeLimitMs: ticket.timeLimitMs,
      passThreshold: ticket.passThreshold,
      order: ticket.questions.map((q) => ({ id: q.id, answers: q.answers.map((a) => a.id) })),
      responses,
      index,
    });
  }, [area.slug, ticket, responses, index, result]);

  function start() {
    const t = generateTicket(questions, { ...config, now: Date.now() });
    setTicket(t);
    setResponses({});
    setIndex(0);
    setResult(null);
    finishedRef.current = false;
    setNow(Date.now());
    reachGoal("exam_started", { area: area.code });
  }

  const q = ticket?.questions[index];
  const selected = (q && responses[q.id]) || [];

  function choose(answerId: number) {
    if (!q) return;
    setResponses((r) => {
      return { ...r, [q.id]: toggleChoice(q, r[q.id] ?? [], answerId) };
    });
  }

  const answeredCount = ticket ? ticket.questions.filter((x) => (responses[x.id]?.length ?? 0) > 0).length : 0;
  const isLast = ticket ? index === ticket.questions.length - 1 : false;

  function goNextOrFinish() {
    if (!ticket) return;
    if (!isLast) setIndex(index + 1);
    else setConfirming(true);
  }

  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setConfirming(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming]);

  useAnswerHotkeys(
    {
      onDigit: (i) => {
        const a = q?.answers[i];
        if (a) choose(a.id);
      },
      onEnter: goNextOrFinish,
    },
    !!ticket && !result && !confirming,
  );

  if (!ready) return <div className="h-40 animate-pulse rounded-xl bg-surface-2" aria-busy="true" />;

  if (result) return <ExamResultView area={area} result={result} onRestart={start} />;

  if (!ticket || !q) {
    const count = Math.min(config.count, questions.length);
    return (
      <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h1 className="text-2xl font-bold">Пробный экзамен {area.code}</h1>
        <p className="mt-1 text-muted">{area.title}</p>
        <ul className="mt-5 space-y-1.5">
          <li>
            📝 {count} {pluralRu(count, "вопрос", "вопроса", "вопросов")} в случайном порядке
          </li>
          <li>⏱ {config.timeLimitMin} минут, по истечении времени экзамен завершится сам</li>
          <li>
            ✅ Чтобы сдать, нужно ответить верно минимум на{" "}
            {generateTicket(questions, { ...config, now: 0 }, () => 0).passThreshold}
          </li>
          <li>🙈 Правильные ответы покажем только в конце</li>
        </ul>
        {questions.length === 0 ? (
          <p className="mt-5 text-muted">В этой области пока нет вопросов.</p>
        ) : (
          <button type="button" onClick={start} className="btn-primary mt-6 w-full sm:w-auto">
            Начать экзамен
          </button>
        )}
      </div>
    );
  }

  const left = remainingMs(ticket, now);
  const unanswered = ticket.questions.length - answeredCount;

  return (
    <div className="pb-24 sm:pb-0">
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-line bg-bg/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">
            Экзамен {area.code} · отвечено {answeredCount}/{ticket.questions.length}
          </span>
          <span
            className={`font-mono text-lg font-semibold tabular-nums ${left < 60_000 ? "text-bad" : ""}`}
            role="timer"
            aria-label="Осталось времени"
          >
            {formatClock(left)}
          </span>
        </div>
        <nav aria-label="Навигация по вопросам" className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {ticket.questions.map((x, i) => {
            const done = (responses[x.id]?.length ?? 0) > 0;
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-current={i === index ? "step" : undefined}
                aria-label={`Вопрос ${i + 1}${done ? ", есть ответ" : ""}`}
                className={`grid size-9 shrink-0 place-items-center rounded-lg border text-sm tabular-nums ${
                  i === index ? "border-brand ring-1 ring-brand" : "border-line"
                } ${done ? "bg-surface-2 font-semibold" : "bg-surface text-muted"}`}
              >
                {i + 1}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mb-2 text-sm text-muted">
        Вопрос {index + 1} из {ticket.questions.length}
        {kindHint(q) && ` · ${kindHint(q)}`}
      </div>
      <h1 className="mb-5 text-lg font-semibold leading-snug sm:text-xl">{q.text}</h1>
      <QuestionImage src={q.image} />
      <AnswerList
        answers={q.answers}
        multi={q.multi}
        kind={q.kind}
        selected={selected}
        revealed={false}
        onChoose={choose}
      />

      <div className="fixed inset-x-0 bottom-[var(--cookie-h,0px)] z-30 flex gap-2 border-t border-line bg-surface/95 p-3 backdrop-blur sm:static sm:mt-5 sm:border-0 sm:bg-transparent sm:p-0">
        <button
          type="button"
          onClick={() => setIndex(Math.max(0, index - 1))}
          disabled={index === 0}
          className="btn-secondary flex-1 disabled:opacity-40"
        >
          Назад
        </button>
        {isLast ? (
          <button type="button" onClick={() => setConfirming(true)} className="btn-primary flex-1">
            Завершить
          </button>
        ) : (
          <button type="button" onClick={() => setIndex(index + 1)} className="btn-primary flex-1">
            Дальше
          </button>
        )}
      </div>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm text-muted underline hover:text-fg"
        >
          Завершить экзамен досрочно
        </button>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl">
            <p className="text-lg font-semibold">Завершить экзамен?</p>
            {unanswered > 0 && (
              <p className="mt-1 text-muted">
                Без ответа: {unanswered} {pluralRu(unanswered, "вопрос", "вопроса", "вопросов")}. Они будут засчитаны
                как ошибки.
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="btn-secondary flex-1">
                Вернуться
              </button>
              <button type="button" onClick={() => finish(ticket, responses)} className="btn-primary flex-1" autoFocus>
                Завершить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExamResultView({
  area,
  result,
  onRestart,
}: {
  area: { slug: string; code: string };
  result: ExamResult<ClientQuestion>;
  onRestart: () => void;
}) {
  return (
    <div>
      <div
        className={`rounded-2xl border-2 p-5 text-center sm:p-6 ${result.passed ? "border-ok bg-ok-bg" : "border-bad bg-bad-bg"}`}
        data-testid="exam-result"
      >
        <p className="text-3xl font-bold">{result.passed ? "Сдал ✅" : "Не сдал"}</p>
        <p className="mt-1 text-lg">
          {result.correct} из {result.total} верно
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={onRestart} className="btn-primary flex-1">
          Пройти ещё раз
        </button>
        {result.mistakes.length > 0 && (
          <Link href={`/${area.slug}/mistakes`} className="btn-secondary flex-1">
            Работа над ошибками
          </Link>
        )}
        <Link href={`/${area.slug}`} className="btn-secondary flex-1">
          К области {area.code}
        </Link>
      </div>
      <div className="mt-4">
        <ShareButtons
          url={absoluteUrl(`/${area.slug}`)}
          text={`Пробный экзамен по области ${area.code}: ${result.correct} из ${result.total} верно${result.passed ? ", сдал" : ""}. Проверь себя бесплатно:`}
          where="exam"
        />
      </div>

      {result.mistakes.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">Ошибки ({result.mistakes.length})</h2>
          <ol className="space-y-6">
            {result.mistakes.map(({ question: q, selected }) => {
              return (
                <li key={q.id} className="rounded-2xl border border-line bg-surface p-4">
                  <p className="mb-1 text-sm text-muted">
                    Вопрос №{q.number}
                    {selected.length === 0 && " · без ответа"}
                  </p>
                  <p className="mb-3 font-semibold">{q.text}</p>
                  <QuestionImage src={q.image} />
                  <AnswerList
                    answers={q.answers}
                    multi={q.multi}
                    kind={q.kind}
                    selected={selected}
                    revealed
                    onChoose={() => {}}
                  />
                  <Explanation explanation={q.explanation} normRef={q.normRef} />
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
