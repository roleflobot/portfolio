"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import type { LearningSession } from "@/lib/supabase/types";
import {
  groupSessionsByWeek,
  getVocabReview,
  getBlankReview,
  type WeekBucket,
  type VocabQuestion,
  type BlankQuestion,
} from "@/lib/review";

export default function ReviewPage() {
  const [sessions, setSessions] = useState<LearningSession[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase
      .from("learning_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLoadError("학습 기록을 불러오지 못했습니다.");
          return;
        }
        setSessions((data as LearningSession[]) ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const weeks = useMemo(() => groupSessionsByWeek(sessions ?? []), [sessions]);
  const activeWeek = weeks.find((w) => w.weekKey === selectedWeek) ?? null;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Link
        href="/"
        className="font-mono text-xs text-ink-faint uppercase hover:text-ink"
      >
        ← 홈으로
      </Link>

      <h1 className="mt-3 font-serif text-2xl font-bold">복습</h1>

      {loadError && <p className="mt-8 text-danger">{loadError}</p>}

      {!loadError && sessions === null && (
        <p className="mt-8 text-ink-faint">불러오는 중...</p>
      )}

      {!loadError && sessions !== null && sessions.length === 0 && (
        <p className="mt-8 text-ink-faint">
          아직 학습한 기록이 없습니다. 홈에서 뉴스를 선택해 학습을 시작해보세요.
        </p>
      )}

      {!loadError && sessions !== null && sessions.length > 0 && !activeWeek && (
        <div className="mt-6">
          <p className="mb-3 text-sm text-ink-soft">
            복습할 주간을 골라주세요. 그 주에 배운 단어와 지문으로 문제를 만들어드립니다.
          </p>
          <div className="rounded-md border border-border bg-surface px-6">
            {weeks.map((w, i) => (
              <button
                key={w.weekKey}
                onClick={() => setSelectedWeek(w.weekKey)}
                className={`flex w-full items-center justify-between py-4 text-left hover:bg-surface-2 ${
                  i !== weeks.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <span className="font-semibold">{w.label}</span>
                <span className="font-mono text-xs text-ink-faint">
                  뉴스 {w.sessions.length}개
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeWeek && (
        <div className="mt-6">
          <button
            onClick={() => setSelectedWeek(null)}
            className="mb-4 font-mono text-xs text-ink-faint uppercase hover:text-ink"
          >
            ← 주간 다시 고르기
          </button>
          <ReviewWeek week={activeWeek} />
        </div>
      )}
    </main>
  );
}

function ReviewWeek({ week }: { week: WeekBucket }) {
  const { user } = useAuth();
  const [vocabQuiz, setVocabQuiz] = useState<VocabQuestion[] | null>(null);
  const [blankQuiz, setBlankQuiz] = useState<BlankQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setVocabQuiz(null);
    setBlankQuiz(null);
    setError(null);

    const supabase = createClient();
    Promise.all([
      getVocabReview(supabase, user.id, week.weekKey, week.sessions),
      getBlankReview(supabase, user.id, week.weekKey, week.sessions),
    ])
      .then(([vq, bq]) => {
        if (cancelled) return;
        setVocabQuiz(vq);
        setBlankQuiz(bq);
      })
      .catch(() => {
        if (!cancelled) setError("복습 문제를 만들지 못했습니다. 다시 시도해주세요.");
      });

    return () => {
      cancelled = true;
    };
  }, [user, week]);

  return (
    <div className="rounded-md border border-border bg-surface">
      <div className="border-b-2 border-double border-border-strong px-6 pt-5 pb-4">
        <h2 className="font-serif text-xl font-semibold">{week.label} 복습</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(() => {
            const titles = Array.from(new Set(week.sessions.map((s) => s.news_title)));
            const shown = titles.slice(0, 3);
            const rest = titles.length - shown.length;
            return (
              <>
                {shown.map((title) => (
                  <span
                    key={title}
                    className="rounded-sm border border-border px-2 py-0.5 text-xs text-ink-soft"
                  >
                    {title}
                  </span>
                ))}
                {rest > 0 && (
                  <span className="rounded-sm border border-border px-2 py-0.5 text-xs text-ink-faint">
                    외 {rest}건
                  </span>
                )}
              </>
            );
          })()}
        </div>
      </div>

      <div className="px-6">
        {error && <p className="py-5 text-sm text-danger">{error}</p>}

        {!error && (vocabQuiz === null || blankQuiz === null) && (
          <p className="py-5 text-sm text-ink-faint">문제를 만드는 중...</p>
        )}

        {!error && vocabQuiz !== null && blankQuiz !== null && (
          <>
            <section className="border-t border-border py-5 first:border-t-0">
              <div className="mb-3 font-mono text-[0.72rem] text-ink-faint uppercase">
                Section 1 · 단어 복습
              </div>
              {vocabQuiz.length === 0 ? (
                <p className="text-sm text-ink-faint">
                  이 주는 복습할 단어가 충분하지 않습니다.
                </p>
              ) : (
                <VocabReview key={vocabQuiz.map((q) => q.itemKey).join(",")} questions={vocabQuiz} />
              )}
            </section>

            <section className="border-t border-border py-5">
              <div className="mb-3 font-mono text-[0.72rem] text-ink-faint uppercase">
                Section 2 · 지문 빈칸 복습 (원문 그대로)
              </div>
              {blankQuiz.length === 0 ? (
                <p className="text-sm text-ink-faint">
                  이 주는 복습할 지문이 충분하지 않습니다.
                </p>
              ) : (
                <BlankReview key={blankQuiz.map((q) => q.itemKey).join(",")} questions={blankQuiz} />
              )}
            </section>

            <div className="border-t border-border py-6">
              <Link
                href="/"
                className="font-mono text-xs text-ink-faint uppercase hover:text-ink"
              >
                ← 홈으로
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function VocabReview({ questions }: { questions: VocabQuestion[] }) {
  const [answers, setAnswers] = useState<(string | null)[]>(
    Array(questions.length).fill(null)
  );
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(index: number, value: string) {
    if (submitted) return;
    const next = [...answers];
    next[index] = value;
    setAnswers(next);
  }

  function submit() {
    if (answers.some((a) => a === null)) {
      setError("모든 문제에 답해주세요.");
      return;
    }
    setError(null);
    setSubmitted(true);
  }

  const correctCount = submitted
    ? questions.reduce((acc, q, i) => acc + (q.answer === answers[i] ? 1 : 0), 0)
    : null;

  return (
    <div className="flex flex-col gap-4">
      {questions.map((q, i) => {
        const userAnswer = answers[i];
        const isCorrect = submitted && userAnswer === q.answer;
        return (
          <div key={i} className="rounded-sm border border-border p-3.5">
            <p className="text-sm font-semibold">
              {i + 1}. {q.direction === "en-ko" ? `"${q.prompt}"의 뜻은?` : `"${q.prompt}"에 맞는 단어는?`}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {q.options.map((option) => {
                const isPicked = userAnswer === option;
                const showAsCorrect = submitted && isPicked && option === q.answer;
                const showAsWrong = submitted && isPicked && option !== q.answer;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={submitted}
                    onClick={() => pick(i, option)}
                    className={`rounded-full border px-3.5 py-1 text-sm transition-colors ${
                      showAsCorrect
                        ? "border-success bg-success-tint text-success"
                        : showAsWrong
                          ? "border-danger bg-danger-tint text-danger"
                          : isPicked
                            ? "border-accent bg-accent-tint text-accent-ink"
                            : "border-border-strong hover:bg-surface-2"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {submitted && (
              <p className={`mt-2.5 text-sm ${isCorrect ? "text-success" : "text-danger"}`}>
                {isCorrect ? "✅ 정답" : `❌ 오답 — 정답: ${q.answer}`}
              </p>
            )}
          </div>
        );
      })}

      <div>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        {!submitted ? (
          <button
            onClick={submit}
            className="rounded-sm border border-accent bg-accent-tint px-4 py-2 font-mono text-xs text-accent-ink uppercase"
          >
            제출하기
          </button>
        ) : (
          <p className="font-mono text-xs text-ink-faint uppercase">
            결과: {correctCount} / {questions.length}
          </p>
        )}
      </div>
    </div>
  );
}

function BlankReview({ questions }: { questions: BlankQuestion[] }) {
  const [answers, setAnswers] = useState<(string | null)[]>(
    Array(questions.length).fill(null)
  );
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(index: number, value: string) {
    if (submitted) return;
    const next = [...answers];
    next[index] = value;
    setAnswers(next);
  }

  function submit() {
    if (answers.some((a) => a === null)) {
      setError("모든 문제에 답해주세요.");
      return;
    }
    setError(null);
    setSubmitted(true);
  }

  const correctCount = submitted
    ? questions.reduce((acc, q, i) => acc + (q.answer === answers[i] ? 1 : 0), 0)
    : null;

  return (
    <div className="flex flex-col gap-4">
      {questions.map((q, i) => {
        const userAnswer = answers[i];
        const isCorrect = submitted && userAnswer === q.answer;
        return (
          <div key={i} className="rounded-sm border border-border p-3.5">
            <p className="text-sm font-semibold">
              {i + 1}. {q.sentence}
            </p>
            <p className="mt-0.5 text-xs text-ink-faint">{q.translation}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {q.options.map((option) => {
                const isPicked = userAnswer === option;
                const showAsCorrect = submitted && isPicked && option === q.answer;
                const showAsWrong = submitted && isPicked && option !== q.answer;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={submitted}
                    onClick={() => pick(i, option)}
                    className={`rounded-full border px-3.5 py-1 text-sm transition-colors ${
                      showAsCorrect
                        ? "border-success bg-success-tint text-success"
                        : showAsWrong
                          ? "border-danger bg-danger-tint text-danger"
                          : isPicked
                            ? "border-accent bg-accent-tint text-accent-ink"
                            : "border-border-strong hover:bg-surface-2"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {submitted && (
              <p className={`mt-2.5 text-sm ${isCorrect ? "text-success" : "text-danger"}`}>
                {isCorrect ? "✅ 정답" : `❌ 오답 — 정답: ${q.answer}`}
              </p>
            )}
          </div>
        );
      })}

      <div>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        {!submitted ? (
          <button
            onClick={submit}
            className="rounded-sm border border-accent bg-accent-tint px-4 py-2 font-mono text-xs text-accent-ink uppercase"
          >
            제출하기
          </button>
        ) : (
          <p className="font-mono text-xs text-ink-faint uppercase">
            결과: {correctCount} / {questions.length}
          </p>
        )}
      </div>
    </div>
  );
}
