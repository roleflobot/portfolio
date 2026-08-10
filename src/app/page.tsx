"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import LoginOptions from "@/components/LoginOptions";
import { CategoryTag } from "@/components/CategoryStamp";

type Topic = {
  topic: string;
  searchQuery: string;
  representativeTitle: string;
  category: string;
  url: string | null;
};

const NICKNAME_ADJECTIVES = [
  "부지런한",
  "호기심많은",
  "느긋한",
  "꼼꼼한",
  "용감한",
  "차분한",
  "밝은",
  "성실한",
];
const NICKNAME_NOUNS = ["독자", "여우", "기자", "탐정", "올빼미", "다람쥐", "고래", "펭귄"];

function suggestNickname() {
  const adj = NICKNAME_ADJECTIVES[Math.floor(Math.random() * NICKNAME_ADJECTIVES.length)];
  const noun = NICKNAME_NOUNS[Math.floor(Math.random() * NICKNAME_NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}${noun}${num}`;
}

function todayDateline() {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
  const time = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  return `SEOUL · ${date} · ${time} KST`;
}

export default function HomePage() {
  const router = useRouter();
  const { isGuest, nickname, loading: authLoading, setNickname } = useAuth();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateUpdating, setGenerateUpdating] = useState(false);

  const [pending, setPending] = useState<{ topic: Topic; index: number } | null>(
    null
  );
  const [nicknameInput, setNicknameInput] = useState("");
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [nicknamePending, setNicknamePending] = useState(false);

  // 서버 렌더 시각과 하이드레이션 시각이 달라 텍스트가 어긋나는 걸 피하려고
  // 마운트 후에만 채운다(빈 문자열이면 표시하지 않음).
  const [dateline, setDateline] = useState("");
  useEffect(() => {
    setDateline(todayDateline());
    const id = setInterval(() => setDateline(todayDateline()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (pending && !nicknameInput) setNicknameInput(suggestNickname());
  }, [pending, nicknameInput]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/news")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "뉴스를 불러오지 못했습니다.");
        if (!cancelled) setTopics(data.topics ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "뉴스를 불러오지 못했습니다."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function generate(topic: Topic, index: number) {
    setGenerateError(null);
    setGenerateUpdating(false);
    setGeneratingIndex(index);
    setPending(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(topic),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.updating) setGenerateUpdating(true);
        throw new Error(data.error || "학습자료를 만들지 못했습니다.");
      }

      router.push(`/study/${data.session.id}`);
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "학습자료를 만들지 못했습니다."
      );
      setGeneratingIndex(null);
    }
  }

  function handleCardClick(topic: Topic, index: number) {
    if (authLoading) return;

    // 로그인된 회원이거나 게스트 닉네임이 이미 있으면 바로 생성한다.
    if (!isGuest || nickname) {
      generate(topic, index);
    } else {
      setPending({ topic, index });
    }
  }

  async function confirmNickname() {
    setNicknameError(null);
    const value = nicknameInput.trim();
    if (!value) {
      setNicknameError("닉네임을 입력해주세요.");
      return;
    }

    setNicknamePending(true);
    try {
      await setNickname(value);
      const p = pending;
      if (p) generate(p.topic, p.index);
    } catch (err) {
      setNicknameError(
        err instanceof Error ? err.message : "닉네임 설정 중 오류가 발생했습니다."
      );
    } finally {
      setNicknamePending(false);
    }
  }

  if (pending) {
    return (
      <main className="mx-auto w-full max-w-sm flex-1 px-4 py-10">
        <div className="rounded-md border border-border bg-surface p-6">
          <h2 className="font-semibold">닉네임을 정해주세요</h2>
          <p className="mt-1 text-sm text-ink-soft">
            로그인 없이도 이 닉네임으로 나만의 학습 기록이 쌓입니다. 마음에
            들지 않으면 자유롭게 바꿔도 좋아요.
          </p>

          <div className="mt-4 flex gap-2">
            <input
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              maxLength={20}
              className="w-full rounded-sm border border-border-strong px-3 py-2 text-sm"
              placeholder="닉네임"
            />
            <button
              onClick={() => setNicknameInput(suggestNickname())}
              type="button"
              className="shrink-0 rounded-sm border border-border-strong px-3 py-2 text-xs hover:bg-surface-2"
            >
              다른 닉네임
            </button>
          </div>
          {nicknameError && <p className="mt-2 text-xs text-danger">{nicknameError}</p>}

          <button
            onClick={confirmNickname}
            disabled={nicknamePending}
            className="mt-3 w-full rounded-sm border border-accent bg-accent-tint px-3 py-2 text-sm text-accent-ink disabled:opacity-50"
          >
            {nicknamePending ? "처리 중..." : "이 닉네임으로 학습 시작"}
          </button>

          <div className="my-4 flex items-center gap-2 font-mono text-[0.7rem] text-ink-soft uppercase">
            <div className="h-px flex-1 bg-border" />
            또는 로그인
            <div className="h-px flex-1 bg-border" />
          </div>

          <LoginOptions
            onSuccess={() => {
              const p = pending;
              if (p) generate(p.topic, p.index);
            }}
          />

          <button
            onClick={() => setPending(null)}
            className="mt-3 block text-xs text-ink-faint underline"
          >
            뒤로가기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-10">
      <div className="mb-4 overflow-hidden rounded-md border border-border bg-surface">
        <Image
          src="/english.png"
          alt="Daily English Hub — 뉴스로 배우는 실전 영어"
          width={2172}
          height={493}
          className="w-full h-auto"
          priority
        />
      </div>

      <div className="rounded-md border border-border bg-surface">
        <div className="border-b-2 border-double border-border-strong px-6 pt-6 pb-4">
          <div className="whitespace-pre-line font-mono text-[0.68rem] tracking-wider text-ink-faint uppercase">
            {dateline}
          </div>
          <p className="mt-2 text-lg text-ink-soft">
            아래 뉴스 중 하나를 골라보세요. 영어 요약과 퀴즈를 만들어드립니다.
          </p>
        </div>

        <div className="px-6 pb-2">
          {loading && (
            <p className="py-8 text-ink-faint">오늘의 뉴스를 불러오는 중...</p>
          )}

          {!loading && loadError && (
            <p className="py-8 text-danger">
              {loadError} 잠시 후 새로고침해주세요.
            </p>
          )}

          {!loading && !loadError && topics.length === 0 && (
            <p className="py-8 text-ink-faint">
              오늘의 뉴스가 아직 준비되지 않았습니다.
            </p>
          )}

          {generateError && (
            <p
              className={`mt-4 text-sm ${
                generateUpdating ? "text-ink-soft" : "text-danger"
              }`}
            >
              {generateError}
            </p>
          )}

          <div>
            {topics.map((topic, index) => (
              <button
                key={index}
                onClick={() => handleCardClick(topic, index)}
                disabled={generatingIndex !== null}
                className={`grid w-full grid-cols-[40px_1fr] gap-4 py-5 text-left disabled:opacity-50 ${
                  index !== topics.length - 1
                    ? "[background-image:repeating-linear-gradient(90deg,var(--border-strong)_0_6px,transparent_6px_12px)] [background-position:bottom] [background-repeat:repeat-x] [background-size:100%_1px]"
                    : ""
                }`}
              >
                <div className="font-serif text-2xl leading-none font-semibold text-ink-faint italic">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div>
                  <CategoryTag category={topic.category} />
                  <div className="mt-2 font-sans text-[1.02rem] font-bold leading-snug">
                    {topic.topic}
                  </div>
                  <div className="mt-0.5 text-sm text-ink-soft">
                    {topic.representativeTitle}
                  </div>
                  {generatingIndex === index && (
                    <div className="mt-2 font-mono text-xs text-accent-ink uppercase">
                      학습자료 준비 중...
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
