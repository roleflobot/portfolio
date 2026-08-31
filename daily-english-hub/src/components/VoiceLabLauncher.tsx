"use client";

import { useState } from "react";
import type { LearningSession } from "@/lib/supabase/types";

const configuredLabUrl = process.env.NEXT_PUBLIC_VOICE_LAB_URL;
const developmentLabUrl = process.env.NODE_ENV === "development" ? "http://localhost:3001" : null;

export default function VoiceLabLauncher({ session }: { session: LearningSession }) {
  const [opening, setOpening] = useState(false);
  const labUrl = configuredLabUrl || developmentLabUrl;

  if (!labUrl) return null;

  async function openVoiceLab() {
    if (opening) return;

    let target: URL;
    try {
      target = new URL(labUrl as string);
      if (target.protocol !== "http:" && target.protocol !== "https:") {
        throw new Error("invalid protocol");
      }
    } catch {
      window.alert("음성 실험실 주소가 올바르지 않습니다.");
      return;
    }

    const accessCode = window.prompt("Section 6 접근 코드를 입력하세요.")?.trim();
    if (!accessCode) return;

    const popup = window.open("about:blank", "_blank");
    if (!popup) {
      window.alert("팝업이 차단되었습니다. 이 사이트의 팝업을 허용해 주세요.");
      return;
    }

    setOpening(true);
    const targetOrigin = target.origin;
    let timeout = 0;

    const cleanup = () => {
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(timeout);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== targetOrigin || event.source !== popup) return;
      if (event.data?.type === "voice-lab-ready") {
        popup?.postMessage(
          {
            type: "daily-english-voice-context",
            context: {
              sessionId: session.id,
              newsTitle: session.news_title,
              category: session.category ?? undefined,
              summary: session.ai_content.summary,
              translation: session.ai_content.translation,
              vocabulary: session.ai_content.vocabulary.map(({ word, meaning }) => ({
                word,
                meaning,
              })),
              quiz: session.ai_content.quiz.map(({ question, answer, explanation, hints }) => ({
                question,
                answer,
                explanation,
                hints,
              })),
              blanks: (session.ai_content.blanks ?? []).map(
                ({ sentence, options, answer, translation, hints }) => ({
                  sentence,
                  options,
                  answer,
                  translation,
                  hints,
                })
              ),
              writingWords: session.ai_content.writingWords ?? [],
            },
          },
          targetOrigin
        );
      }
      if (event.data?.type === "voice-lab-context-received") {
        cleanup();
      }
    };

    try {
      const response = await fetch("/api/voice-lab-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, accessCode }),
      });
      const data = (await response.json()) as { ticket?: string; error?: string };
      if (!response.ok || !data.ticket) {
        throw new Error(data.error || "음성 실험실 인증에 실패했습니다.");
      }

      window.addEventListener("message", handleMessage);
      timeout = window.setTimeout(cleanup, 15_000);
      target.hash = new URLSearchParams({ ticket: data.ticket }).toString();
      popup.location.replace(target.toString());
      popup.focus();
    } catch (error) {
      cleanup();
      popup.close();
      window.alert(error instanceof Error ? error.message : "음성 실험실을 열지 못했습니다.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <section className="border-t border-border py-5" aria-label="Section 6">
      <button
        type="button"
        onClick={openVoiceLab}
        className="w-full rounded-sm border border-accent bg-accent-tint px-4 py-3 text-left font-mono text-xs text-accent-ink uppercase transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        disabled={opening}
      >
        {opening ? "Section 6 · 인증 중…" : "Section 6 · AI 음성 대화 시작하기 ↗"}
      </button>
    </section>
  );
}
