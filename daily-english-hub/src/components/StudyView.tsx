"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { LearningSession, SavedAnswers } from "@/lib/supabase/types";
import { CategoryTag } from "@/components/CategoryStamp";
import VoiceLabLauncher from "@/components/VoiceLabLauncher";

function isSavedAnswers(value: unknown): value is SavedAnswers {
  return (
    !!value &&
    typeof value === "object" &&
    Array.isArray((value as SavedAnswers).quiz) &&
    Array.isArray((value as SavedAnswers).blanks)
  );
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatDateline(iso: string) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(iso)
  );
  const time = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  return `SEOUL · ${date} · ${time} KST`;
}

export default function StudyView({ session }: { session: LearningSession }) {
  const supabase = createClient();
  const { ai_content } = session;
  // 이번 업데이트 이전에 만들어진 세션은 blanks가 없다 — 화면이 깨지지 않도록 빈 배열로 처리한다.
  const blanks = ai_content.blanks ?? [];
  // Gemini가 만든 options는 정답이 항상 첫 번째로 오는 경향이 있어 그대로 보여주면 안 된다.
  // 렌더링마다 다시 섞이면 클릭할 때마다 보기가 움직이므로, 세션당 한 번만 섞어 고정한다.
  const shuffledOptions = useMemo(() => blanks.map((b) => shuffle(b.options)), [blanks]);

  const savedAnswers = isSavedAnswers(session.user_answers)
    ? session.user_answers
    : null;
  // 예전 세션은 user_answers가 boolean[](TF만)이었다. 하위 호환을 위해 그대로 읽는다.
  const legacyQuizAnswers = Array.isArray(session.user_answers)
    ? (session.user_answers as boolean[])
    : null;

  const savedQuiz = savedAnswers?.quiz ?? legacyQuizAnswers ?? null;
  const savedBlanks = savedAnswers?.blanks ?? null;
  // Section 3/4는 이제 순서 상관없이 독립적으로 제출된다 — 저장된 값이 null 없이
  // 전부 채워져 있을 때만 "이미 제출됨"으로 본다(다른 섹션만 먼저 제출된 경우와 구분).
  const quizAlreadySubmitted =
    Array.isArray(savedQuiz) && savedQuiz.length === 3 && savedQuiz.every((a) => typeof a === "boolean");
  const blanksAlreadySubmitted =
    Array.isArray(savedBlanks) &&
    savedBlanks.length === blanks.length &&
    savedBlanks.every((a) => typeof a === "string");

  const [quizAnswers, setQuizAnswers] = useState<(boolean | null)[]>(
    savedQuiz ?? [null, null, null]
  );
  const [blankAnswers, setBlankAnswers] = useState<(string | null)[]>(
    savedBlanks ?? Array(blanks.length).fill(null)
  );
  const [showTranslation, setShowTranslation] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  function cleanupAudio() {
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }

  useEffect(() => cleanupAudio, []);

  function playAudio(src: string, objectUrl?: string) {
    cleanupAudio();
    if (objectUrl) audioUrlRef.current = objectUrl;
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.onended = () => setSpeaking(false);
    audio.onerror = () => {
      setSpeaking(false);
      setTtsError("재생 중 오류가 발생했습니다.");
    };
    return audio.play().then(() => setSpeaking(true));
  }

  async function toggleSpeech() {
    if (speaking) {
      cleanupAudio();
      setSpeaking(false);
      return;
    }

    setTtsError(null);

    // 새벽 배치가 미리 만들어둔 오디오가 있으면 API 호출 없이 바로 재생한다.
    if (session.audio_base64) {
      try {
        await playAudio(`data:audio/wav;base64,${session.audio_base64}`);
        return;
      } catch (err) {
        setTtsError(err instanceof Error ? err.message : "재생 중 오류가 발생했습니다.");
        return;
      }
    }

    setTtsLoading(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ai_content.summary.join(" ") }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "음성을 만들지 못했습니다.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      await playAudio(url, url);
    } catch (err) {
      setTtsError(err instanceof Error ? err.message : "음성을 만들지 못했습니다.");
    } finally {
      setTtsLoading(false);
    }
  }

  // Section 3(TF)과 Section 4(빈칸)는 순서 상관없이 각자 독립적으로 제출·채점한다.
  const [quizSubmitted, setQuizSubmitted] = useState(quizAlreadySubmitted);
  const [blanksSubmitted, setBlanksSubmitted] = useState(blanksAlreadySubmitted);
  const [quizValidationError, setQuizValidationError] = useState<string | null>(null);
  const [blanksValidationError, setBlanksValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingQuiz, setPendingQuiz] = useState(false);
  const [pendingBlanks, setPendingBlanks] = useState(false);

  // Section 5(영작): 제미나이가 준 필수 단어 5개를 모두 써서 요약문을 직접 작성하고,
  // 제출하면 실시간으로 AI 첨삭/피드백을 받는다. 채점 정답이 없는 활동이라 DB에는 저장하지 않는다.
  const writingWords = ai_content.writingWords ?? [];
  const [writingText, setWritingText] = useState("");
  const [writingPending, setWritingPending] = useState(false);
  const [writingError, setWritingError] = useState<string | null>(null);
  const [writingFeedback, setWritingFeedback] = useState<{
    usedAllWords: boolean;
    missingWords: string[];
    corrected: string;
    feedback: string;
  } | null>(null);

  async function handleSubmitWriting() {
    setWritingError(null);
    if (!writingText.trim()) {
      setWritingError("문장을 입력해주세요.");
      return;
    }

    setWritingPending(true);
    try {
      const res = await fetch("/api/writing-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: writingText.trim(),
          requiredWords: writingWords,
          summary: ai_content.summary,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "피드백을 만들지 못했습니다.");
      setWritingFeedback(data);
    } catch (err) {
      setWritingError(err instanceof Error ? err.message : "피드백을 만들지 못했습니다.");
    } finally {
      setWritingPending(false);
    }
  }

  function pickQuiz(index: number, value: boolean) {
    if (quizSubmitted) return;
    const next = [...quizAnswers];
    next[index] = value;
    setQuizAnswers(next);
  }

  function pickBlank(index: number, value: string) {
    if (blanksSubmitted) return;
    const next = [...blankAnswers];
    next[index] = value;
    setBlankAnswers(next);
  }

  // Section 3/4는 어느 쪽을 먼저 제출해도 되므로, 매번 "현재까지 알고 있는 두 섹션의
  // 답"을 합쳐서 저장한다 — 아직 안 낸 섹션은 null이 섞인 채로 저장되고, 그 섹션도
  // 나중에 제출되면 그때 다시 이 값을 덮어써서 최종적으로는 항상 정확해진다.
  async function persistProgress(nextQuiz: (boolean | null)[], nextBlanks: (string | null)[]) {
    const quizCorrect = ai_content.quiz.reduce(
      (acc, q, i) => acc + (nextQuiz[i] === q.answer ? 1 : 0),
      0
    );
    const blankCorrect = blanks.reduce(
      (acc, b, i) => acc + (nextBlanks[i] === b.answer ? 1 : 0),
      0
    );
    const { error } = await supabase
      .from("learning_sessions")
      .update({
        user_answers: { quiz: nextQuiz, blanks: nextBlanks },
        score: quizCorrect + blankCorrect,
      })
      .eq("id", session.id);
    if (error) throw error;
  }

  async function handleSubmitQuiz() {
    setQuizValidationError(null);
    setSaveError(null);
    if (quizAnswers.some((a) => a === null)) {
      setQuizValidationError("Section 3의 모든 문제에 답해주세요.");
      return;
    }

    setPendingQuiz(true);
    try {
      await persistProgress(quizAnswers, blankAnswers);
      setQuizSubmitted(true);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "채점 결과를 저장하지 못했습니다. 다시 시도해주세요."
      );
    } finally {
      setPendingQuiz(false);
    }
  }

  async function handleSubmitBlanks() {
    setBlanksValidationError(null);
    setSaveError(null);

    if (blankAnswers.some((a) => a === null)) {
      setBlanksValidationError("Section 4의 모든 문제에 답해주세요.");
      return;
    }

    setPendingBlanks(true);
    try {
      await persistProgress(quizAnswers, blankAnswers);
      setBlanksSubmitted(true);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "채점 결과를 저장하지 못했습니다. 다시 시도해주세요."
      );
    } finally {
      setPendingBlanks(false);
    }
  }

  const quizCorrectCount = quizSubmitted
    ? ai_content.quiz.reduce(
        (acc, q, i) => acc + (q.answer === quizAnswers[i] ? 1 : 0),
        0
      )
    : null;
  const blankCorrectCount = blanksSubmitted
    ? blanks.reduce((acc, b, i) => acc + (b.answer === blankAnswers[i] ? 1 : 0), 0)
    : null;
  const maxScore = ai_content.quiz.length + blanks.length;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <Link
        href="/"
        className="font-mono text-xs text-ink-faint uppercase hover:text-ink"
      >
        ← 홈으로
      </Link>

      <div className="mt-4 rounded-md border border-border bg-surface">
        <div className="border-b-2 border-double border-border-strong px-6 pt-5 pb-4">
          <div className="flex items-center justify-between gap-3">
            {session.category && <CategoryTag category={session.category} />}
            <div className="font-mono text-[0.68rem] text-ink-faint uppercase">
              {formatDateline(session.created_at)}
            </div>
          </div>
          <h1 className="mt-3 font-serif text-xl leading-snug font-semibold text-balance">
            {session.news_title}
          </h1>
        </div>

        <div className="px-6">
          <section className="border-t border-border py-5 first:border-t-0">
            <div className="mb-3 font-mono text-[0.72rem] text-ink-faint uppercase">
              Section 1 · Key Vocabulary
            </div>
            <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
              {ai_content.vocabulary.map((v, i) => (
                <li key={i} className="flex items-baseline gap-2 text-sm">
                  <span className="font-serif text-base font-semibold italic">
                    {v.word}
                  </span>
                  <span className="text-ink-soft">— {v.meaning}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="border-t border-border py-5">
            <div className="mb-3 flex items-center justify-between font-mono text-[0.72rem] text-ink-faint uppercase">
              <div className="flex items-center gap-2">
                <span>Section 2 · Reading</span>
                <button
                  type="button"
                  onClick={toggleSpeech}
                  disabled={ttsLoading}
                  aria-label={speaking ? "낭독 중지" : "영어로 듣기"}
                  className={`rounded-full border p-1.5 transition-colors disabled:opacity-50 ${
                    speaking
                      ? "border-accent bg-accent-tint text-accent-ink"
                      : "border-border-strong text-ink-faint hover:bg-surface-2"
                  }`}
                >
                  {ttsLoading ? (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                      <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
                    </svg>
                  ) : speaking ? (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="6" y="6" width="12" height="12" rx="1.5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="4,7 9,7 14,3 14,21 9,17 4,17" />
                      <path d="M17.5 8.5a5 5 0 0 1 0 7" />
                      <path d="M20 6a8.5 8.5 0 0 1 0 12" />
                    </svg>
                  )}
                </button>
                {ttsError && (
                  <span className="normal-case text-danger">{ttsError}</span>
                )}
              </div>
              <label className="flex cursor-pointer items-center gap-2 normal-case">
                해석보기
                <button
                  type="button"
                  role="switch"
                  aria-checked={showTranslation}
                  onClick={() => setShowTranslation((v) => !v)}
                  className={`relative h-5 w-9 rounded-full border transition-colors ${
                    showTranslation
                      ? "border-accent bg-accent"
                      : "border-border-strong bg-border-strong"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full border border-border-strong bg-paper shadow-sm transition-transform ${
                      showTranslation ? "translate-x-0" : "translate-x-4"
                    }`}
                  />
                </button>
              </label>
            </div>

            <div className="flex flex-col gap-3">
              {ai_content.summary.map((sentence, i) => (
                <div key={i}>
                  <p className="text-[1.02rem] leading-relaxed">{sentence}</p>
                  {showTranslation && (
                    <p className="mt-0.5 text-sm text-ink-faint">
                      {ai_content.translation[i]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-border py-5">
            <div className="mb-3 font-mono text-[0.72rem] text-ink-faint uppercase">
              Section 3 · True / False
            </div>

            <div className="flex flex-col gap-4">
              {ai_content.quiz.map((q, i) => {
                const userAnswer = quizAnswers[i];
                const isCorrect = quizSubmitted && userAnswer === q.answer;

                return (
                  <div key={i} className="rounded-sm border border-border p-3.5">
                    <p className="text-sm font-semibold">
                      {i + 1}. {q.question}
                    </p>
                    {q.hints && q.hints.length > 0 && (
                      <p className="mt-0.5 text-sm text-ink-faint">
                        {q.hints.map((h) => `${h.word} — ${h.meaning}`).join(" · ")}
                      </p>
                    )}

                    <div className="mt-2.5 flex gap-2">
                      {[true, false].map((value) => {
                        const isPicked = userAnswer === value;
                        const showAsCorrect =
                          quizSubmitted && isPicked && value === q.answer;
                        const showAsWrong =
                          quizSubmitted && isPicked && value !== q.answer;
                        return (
                          <button
                            key={String(value)}
                            type="button"
                            disabled={quizSubmitted}
                            onClick={() => pickQuiz(i, value)}
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
                            {value ? "True" : "False"}
                          </button>
                        );
                      })}
                    </div>

                    {quizSubmitted && (
                      <p
                        className={`mt-2.5 text-sm ${
                          isCorrect ? "text-success" : "text-danger"
                        }`}
                      >
                        {isCorrect ? "✅ 정답" : "❌ 오답"} — {q.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              {quizValidationError && (
                <p className="mb-3 text-sm text-danger">{quizValidationError}</p>
              )}
              {saveError && !blanksValidationError && (
                <p className="mb-3 text-sm text-danger">{saveError}</p>
              )}
              {!quizSubmitted ? (
                <button
                  onClick={handleSubmitQuiz}
                  disabled={pendingQuiz}
                  className="rounded-sm border border-accent bg-accent-tint px-4 py-2 font-mono text-xs text-accent-ink uppercase disabled:opacity-50"
                >
                  {pendingQuiz ? "채점 중..." : "제출하기"}
                </button>
              ) : (
                <p className="font-mono text-xs text-ink-faint uppercase">
                  Section 3 결과: {quizCorrectCount} / {ai_content.quiz.length}
                </p>
              )}
            </div>
          </section>

          {blanks.length > 0 && (
            <section className="border-t border-border py-5">
              <div className="mb-3 font-mono text-[0.72rem] text-ink-faint uppercase">
                Section 4 · Fill in the Blank
              </div>

              <div className="flex flex-col gap-4">
                {blanks.map((b, i) => {
                  const userAnswer = blankAnswers[i];
                  const isCorrect = blanksSubmitted && userAnswer === b.answer;

                  return (
                    <div key={i} className="rounded-sm border border-border p-3.5">
                      <p className="text-sm font-semibold">
                        {i + 1}. {b.sentence.replace(/_{3,}/g, "______")}
                      </p>
                      {b.hints && b.hints.length > 0 && (
                        <p className="mt-0.5 text-sm text-ink-faint">
                          {b.hints.map((h) => `${h.word} — ${h.meaning}`).join(" · ")}
                        </p>
                      )}

                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {shuffledOptions[i].map((option) => {
                          const isPicked = userAnswer === option;
                          const showAsCorrect =
                            blanksSubmitted && isPicked && option === b.answer;
                          const showAsWrong =
                            blanksSubmitted && isPicked && option !== b.answer;
                          return (
                            <button
                              key={option}
                              type="button"
                              disabled={blanksSubmitted}
                              onClick={() => pickBlank(i, option)}
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

                      {blanksSubmitted && (
                        <>
                          <p
                            className={`mt-2.5 text-sm ${
                              isCorrect ? "text-success" : "text-danger"
                            }`}
                          >
                            {isCorrect ? "✅ 정답" : `❌ 오답 — 정답: ${b.answer}`}
                          </p>
                          {b.translation && (
                            <p className="mt-1 text-sm text-ink-faint">{b.translation}</p>
                          )}
                          {b.optionHints && b.optionHints.length > 0 && (
                            <p className="mt-1 text-sm text-ink-faint">
                              해설:{" "}
                              {b.optionHints
                                .map((h) => `${h.word} — ${h.meaning}`)
                                .join(" · ")}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4">
                {blanksValidationError && (
                  <p className="mb-3 text-sm text-danger">{blanksValidationError}</p>
                )}
                {saveError && <p className="mb-3 text-sm text-danger">{saveError}</p>}

                {!blanksSubmitted ? (
                  <button
                    onClick={handleSubmitBlanks}
                    disabled={pendingBlanks}
                    className="rounded-sm border border-accent bg-accent-tint px-4 py-2 font-mono text-xs text-accent-ink uppercase disabled:opacity-50"
                  >
                    {pendingBlanks ? "채점 중..." : "제출하기"}
                  </button>
                ) : (
                  <p className="font-mono text-xs text-ink-faint uppercase">
                    Section 4 결과: {blankCorrectCount} / {blanks.length}
                  </p>
                )}
              </div>
            </section>
          )}

          {quizSubmitted && blanksSubmitted && (
            <div className="border-t border-border py-6">
              <p className="font-serif text-lg font-semibold">
                Total Score: {(quizCorrectCount ?? 0) + (blankCorrectCount ?? 0)} /{" "}
                {maxScore}
              </p>
            </div>
          )}

          {writingWords.length > 0 && (
            <section className="border-t border-border py-5">
              <div className="mb-3 font-mono text-[0.72rem] text-ink-faint uppercase">
                Section 5 · Write Your Own Summary
              </div>
              <p className="text-sm text-ink-soft">
                아래 단어 {writingWords.length}개를 전부 사용해서, 이 뉴스를 요약하는
                영어 문장 1개~3개를 총 50단어 내외로 직접 작성해보세요.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {writingWords.map((w) => (
                  <span
                    key={w}
                    className="rounded-full border border-accent bg-accent-tint px-3 py-1 text-sm text-accent-ink"
                  >
                    {w}
                  </span>
                ))}
              </div>

              <textarea
                value={writingText}
                onChange={(e) => setWritingText(e.target.value)}
                disabled={writingPending}
                rows={3}
                placeholder="예: The government announced a new policy..."
                className="mt-3 w-full rounded-sm border border-border-strong px-3 py-2 text-sm disabled:opacity-50"
              />

              {writingError && <p className="mt-2 text-sm text-danger">{writingError}</p>}

              <button
                onClick={handleSubmitWriting}
                disabled={writingPending}
                className="mt-2 rounded-sm border border-accent bg-accent-tint px-4 py-2 font-mono text-xs text-accent-ink uppercase disabled:opacity-50"
              >
                {writingPending ? "첨삭 중..." : writingFeedback ? "다시 제출하기" : "제출하기"}
              </button>

              {writingFeedback && (
                <div className="mt-4 rounded-sm border border-border bg-surface-2 p-3.5">
                  {!writingFeedback.usedAllWords && (
                    <p className="text-sm text-danger">
                      ⚠️ 사용하지 않은 단어: {writingFeedback.missingWords.join(", ")}
                    </p>
                  )}
                  <p className="mt-1 text-sm font-semibold">첨삭: {writingFeedback.corrected}</p>
                  <p className="mt-1.5 text-sm text-ink-soft">{writingFeedback.feedback}</p>
                </div>
              )}
            </section>
          )}

          <VoiceLabLauncher session={session} />

          <div className="border-t border-border py-6">
            <Link
              href="/"
              className="font-mono text-xs text-ink-faint uppercase hover:text-ink"
            >
              ← 홈으로
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
