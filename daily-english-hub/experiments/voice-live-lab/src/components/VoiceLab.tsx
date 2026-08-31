"use client";

import type { LiveServerMessage, Session, Transcription } from "@google/genai";
import { useCallback, useEffect, useRef, useState } from "react";
import { arrayBufferToBase64, PcmPlayer, startMicrophone, type MicrophoneCapture } from "@/lib/audio";
import {
  parseVoiceLearningContext,
  type VoiceLearningContext,
} from "@/lib/voice-context";

const CONTEXT_STORAGE_KEY = "daily-english-voice-context-v1";
const TICKET_STORAGE_KEY = "daily-english-voice-ticket-v1";
const SESSION_SECONDS = 180;

type ConnectionState = "idle" | "connecting" | "live" | "ended" | "error";

type TranscriptLine = {
  id: number;
  role: "learner" | "tutor";
  text: string;
};

type TokenResponse = {
  token?: string;
  model?: string;
  error?: string;
};

function appendText(current: string, next: string) {
  const clean = next.trim();
  if (!clean) return current;
  if (!current) return clean;
  const separator = /\s$/.test(current) || /^[,.;:!?')]/.test(clean) ? "" : " ";
  return `${current}${separator}${clean}`;
}

function configuredMainOrigin() {
  const source =
    process.env.NEXT_PUBLIC_MAIN_APP_ORIGIN ||
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");
  if (!source) return null;
  try {
    const parsed = new URL(source);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.origin !== source
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function readAccessTicket() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const incoming = new URLSearchParams(hash).get("ticket")?.trim();
  if (incoming) {
    sessionStorage.setItem(TICKET_STORAGE_KEY, incoming);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    return incoming;
  }
  return sessionStorage.getItem(TICKET_STORAGE_KEY)?.trim() || null;
}

function statusCopy(state: ConnectionState) {
  switch (state) {
    case "connecting":
      return "마이크와 Gemini Live를 연결하고 있습니다.";
    case "live":
      return "대화 중 · 편하게 영어로 말해보세요.";
    case "ended":
      return "대화가 종료되었습니다.";
    case "error":
      return "연결을 완료하지 못했습니다.";
    default:
      return "준비되면 마이크를 연결하세요.";
  }
}

export default function VoiceLab() {
  const [context, setContext] = useState<VoiceLearningContext | null>(null);
  const [accessTicket, setAccessTicket] = useState<string | null>(null);
  const [state, setState] = useState<ConnectionState>("idle");
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [liveLearnerText, setLiveLearnerText] = useState("");
  const [liveTutorText, setLiveTutorText] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [tokenUsage, setTokenUsage] = useState<number | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const microphoneRef = useRef<MicrophoneCapture | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const learnerBufferRef = useRef("");
  const tutorBufferRef = useRef("");
  const lineIdRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const isActive = state === "connecting" || state === "live";
  const remainingSeconds = Math.max(0, SESSION_SECONDS - elapsedSeconds);

  const coveredMaterial = context
    ? `${context.summary.length}문장 요약 · TF ${context.quiz.length}문제 · 빈칸 ${context.blanks.length}문제`
    : "";

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [transcript, liveLearnerText, liveTutorText]);

  useEffect(() => {
    const ticket = readAccessTicket();
    const expectedOrigin = configuredMainOrigin();
    if (!ticket || !expectedOrigin) {
      sessionStorage.removeItem(CONTEXT_STORAGE_KEY);
      sessionStorage.removeItem(TICKET_STORAGE_KEY);
      const blockedFrame = window.requestAnimationFrame(() => {
        setState("error");
        setStatusDetail("메인 앱의 Section 6 버튼에서 접근 코드를 인증해 주세요.");
      });
      return () => window.cancelAnimationFrame(blockedFrame);
    }

    const restoreFrame = window.requestAnimationFrame(() => {
      setAccessTicket(ticket);
      const stored = sessionStorage.getItem(CONTEXT_STORAGE_KEY);
      if (stored) {
        try {
          setContext(parseVoiceLearningContext(JSON.parse(stored)));
        } catch {
          sessionStorage.removeItem(CONTEXT_STORAGE_KEY);
        }
      }
    });

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== expectedOrigin || event.source !== window.opener) return;
      if (event.data?.type !== "daily-english-voice-context") return;

      const parsed = parseVoiceLearningContext(event.data.context);
      if (!parsed) {
        setStatusDetail("원래 학습 화면에서 받은 자료를 읽지 못했습니다.");
        setState("error");
        return;
      }

      sessionStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(parsed));
      setContext(parsed);
      setState("idle");
      setStatusDetail("뉴스 학습자료를 안전하게 전달받았습니다.");
      window.opener?.postMessage({ type: "voice-lab-context-received" }, expectedOrigin);
    };

    window.addEventListener("message", handleMessage);
    if (window.opener) {
      window.opener.postMessage({ type: "voice-lab-ready" }, expectedOrigin);
    }

    return () => {
      window.cancelAnimationFrame(restoreFrame);
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const addTranscriptLine = useCallback((role: TranscriptLine["role"], text: string) => {
    const clean = text.trim();
    if (!clean) return;
    lineIdRef.current += 1;
    setTranscript((lines) => [...lines, { id: lineIdRef.current, role, text: clean }]);
  }, []);

  const flushTranscript = useCallback(
    (role: TranscriptLine["role"]) => {
      const buffer = role === "learner" ? learnerBufferRef : tutorBufferRef;
      if (buffer.current.trim()) addTranscriptLine(role, buffer.current);
      buffer.current = "";
      if (role === "learner") setLiveLearnerText("");
      else setLiveTutorText("");
    },
    [addTranscriptLine]
  );

  const collectTranscription = useCallback(
    (role: TranscriptLine["role"], update?: Transcription) => {
      if (!update) return;
      const buffer = role === "learner" ? learnerBufferRef : tutorBufferRef;
      if (update.text) buffer.current = appendText(buffer.current, update.text);
      if (role === "learner") setLiveLearnerText(buffer.current);
      else setLiveTutorText(buffer.current);
      if (update.finished) flushTranscript(role);
    },
    [flushTranscript]
  );

  const handleLiveMessage = useCallback(
    (message: LiveServerMessage) => {
      const content = message.serverContent;

      if (content?.interrupted) {
        playerRef.current?.interrupt();
        tutorBufferRef.current = "";
        setLiveTutorText("");
        setStatusDetail("말씀을 듣기 위해 Gemini의 답변을 멈췄습니다.");
      }

      if (content?.interimInputTranscription?.text) {
        setLiveLearnerText(
          appendText(learnerBufferRef.current, content.interimInputTranscription.text)
        );
      }
      collectTranscription("learner", content?.inputTranscription);
      collectTranscription("tutor", content?.outputTranscription);

      for (const part of content?.modelTurn?.parts ?? []) {
        const audio = part.inlineData;
        if (!audio?.data) continue;
        setStatusDetail("Gemini가 답하고 있습니다. 중간에 말해도 괜찮아요.");
        void playerRef.current?.enqueue(audio.data, audio.mimeType).catch((error) => {
          setStatusDetail(error instanceof Error ? error.message : "음성을 재생하지 못했습니다.");
        });
      }

      if (content?.turnComplete) {
        flushTranscript("learner");
        flushTranscript("tutor");
        setStatusDetail("듣고 있습니다.");
      }

      if (message.usageMetadata?.totalTokenCount) {
        setTokenUsage(message.usageMetadata.totalTokenCount);
      }
      if (message.goAway?.timeLeft) {
        setStatusDetail(`연결이 곧 갱신됩니다 (${message.goAway.timeLeft}).`);
      }
    },
    [collectTranscription, flushTranscript]
  );

  const clearTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  }, []);

  const releaseResources = useCallback(
    async (nextState?: ConnectionState) => {
      clearTimers();
      const microphone = microphoneRef.current;
      const session = sessionRef.current;
      const player = playerRef.current;
      microphoneRef.current = null;
      sessionRef.current = null;
      playerRef.current = null;

      if (session) {
        try {
          session.sendRealtimeInput({ audioStreamEnd: true });
          session.close();
        } catch {
          // The remote side may already have closed the socket.
        }
      }
      await microphone?.stop().catch(() => undefined);
      await player?.close().catch(() => undefined);
      flushTranscript("learner");
      flushTranscript("tutor");
      if (nextState) setState(nextState);
    },
    [clearTimers, flushTranscript]
  );

  useEffect(
    () => () => {
      intentionalCloseRef.current = true;
      void releaseResources();
    },
    [releaseResources]
  );

  const endConversation = useCallback(async () => {
    intentionalCloseRef.current = true;
    await releaseResources("ended");
    setStatusDetail("3분 실험 대화를 마쳤습니다. 자막을 보며 표현을 복습해 보세요.");
  }, [releaseResources]);

  async function startConversation() {
    if (!context || !accessTicket || isActive) return;

    intentionalCloseRef.current = false;
    setState("connecting");
    setStatusDetail("마이크 권한을 허용해 주세요.");
    setTranscript([]);
    setLiveLearnerText("");
    setLiveTutorText("");
    setElapsedSeconds(0);
    setTokenUsage(null);
    learnerBufferRef.current = "";
    tutorBufferRef.current = "";

    const player = new PcmPlayer();
    playerRef.current = player;

    try {
      await player.prepare();

      const microphonePromise = startMicrophone((pcm, sampleRate) => {
        const session = sessionRef.current;
        if (!session) return;
        session.sendRealtimeInput({
          audio: {
            data: arrayBufferToBase64(pcm),
            mimeType: `audio/pcm;rate=${sampleRate}`,
          },
        });
      }).then((microphone) => {
        microphoneRef.current = microphone;
        return microphone;
      });

      const tokenPromise = fetch("/api/live-token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessTicket}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ context }),
      }).then(async (response) => {
        const data = (await response.json()) as TokenResponse;
        if (!response.ok || !data.token || !data.model) {
          throw new Error(data.error || "Gemini Live 토큰을 받지 못했습니다.");
        }
        sessionStorage.removeItem(TICKET_STORAGE_KEY);
        setAccessTicket(null);
        return { token: data.token, model: data.model };
      });

      const [, tokenData] = await Promise.all([microphonePromise, tokenPromise]);
      setStatusDetail("Gemini Live 세션을 여는 중입니다.");

      const { GoogleGenAI, Modality } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: tokenData.token,
        httpOptions: { apiVersion: "v1alpha" },
      });

      const session = await ai.live.connect({
        model: tokenData.model,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => setStatusDetail("연결되었습니다. Gemini가 먼저 질문합니다."),
          onmessage: handleLiveMessage,
          onerror: (event) => {
            console.error("[Gemini Live]", event.error ?? event.message);
            setState("error");
            setStatusDetail("Gemini Live 연결에서 오류가 발생했습니다.");
          },
          onclose: () => {
            if (!intentionalCloseRef.current) {
              intentionalCloseRef.current = true;
              setState("ended");
              setStatusDetail("Gemini Live 연결이 종료되었습니다. 다시 시작할 수 있습니다.");
              void releaseResources();
            }
          },
        },
      });

      sessionRef.current = session;
      setState("live");
      setStatusDetail("Gemini가 첫 질문을 준비하고 있습니다.");
      const startedAt = Date.now();
      intervalRef.current = setInterval(
        () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)),
        1000
      );
      timeoutRef.current = setTimeout(() => void endConversation(), SESSION_SECONDS * 1000);

      session.sendClientContent({
        turns: "Begin the news speaking practice now. Greet the learner briefly and ask the first question.",
        turnComplete: true,
      });
    } catch (error) {
      intentionalCloseRef.current = true;
      await releaseResources("error");
      setStatusDetail(error instanceof Error ? error.message : "음성 대화를 시작하지 못했습니다.");
    }
  }

  return (
    <main className="lab-shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">Daily English Hub · Experimental Lab</p>
          <h1>Newsroom Voice</h1>
        </div>
        <div className={`status-pill status-${state}`}>
          <span aria-hidden="true" />
          {state === "live" ? "LIVE" : state.toUpperCase()}
        </div>
      </header>

      <div className="lab-grid">
        <section className="conversation-panel" aria-labelledby="conversation-title">
          <div className="panel-heading">
            <div>
              <p className="section-label">Gemini Live · 3 minute practice</p>
              <h2 id="conversation-title">AI 영어 뉴스룸</h2>
            </div>
            <div className="timer" aria-label={`남은 시간 ${remainingSeconds}초`}>
              {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, "0")}
            </div>
          </div>

          <div className="connection-copy" role="status" aria-live="polite">
            <strong>{statusCopy(state)}</strong>
            {statusDetail && <span>{statusDetail}</span>}
          </div>

          <div className="transcript" aria-label="실시간 대화 자막">
            {transcript.length === 0 && !liveLearnerText && !liveTutorText ? (
              <div className="empty-transcript">
                <span className="sound-mark" aria-hidden="true">)))</span>
                <p>대화를 시작하면 사용자와 Gemini의 영어 자막이 여기에 나타납니다.</p>
              </div>
            ) : (
              transcript.map((line) => (
                <article key={line.id} className={`utterance utterance-${line.role}`}>
                  <span>{line.role === "learner" ? "YOU" : "GEMINI"}</span>
                  <p>{line.text}</p>
                </article>
              ))
            )}
            {liveLearnerText && (
              <article className="utterance utterance-learner utterance-live">
                <span>YOU · LIVE</span>
                <p>{liveLearnerText}</p>
              </article>
            )}
            {liveTutorText && (
              <article className="utterance utterance-tutor utterance-live">
                <span>GEMINI · LIVE</span>
                <p>{liveTutorText}</p>
              </article>
            )}
            <div ref={transcriptEndRef} />
          </div>

          <div className="controls">
            {!isActive ? (
              <button
                className="primary-button"
                onClick={startConversation}
                disabled={!context || !accessTicket}
              >
                <span className="mic-icon" aria-hidden="true">●</span>
                {(state === "ended" || state === "error") && !accessTicket
                  ? "메인 앱에서 다시 열어주세요"
                  : state === "ended" || state === "error"
                    ? "다시 대화하기"
                    : "마이크 연결하기"}
              </button>
            ) : (
              <button className="stop-button" onClick={() => void endConversation()}>
                <span aria-hidden="true">■</span>
                대화 끝내기
              </button>
            )}
            <p>헤드폰을 사용하면 Gemini가 자기 목소리를 다시 듣는 현상을 줄일 수 있습니다.</p>
          </div>
        </section>

        <aside className="material-panel" aria-labelledby="material-title">
          <div className="section-label">Learning material</div>
          {context ? (
            <>
              <h2 id="material-title">{context.newsTitle}</h2>
              <p className="material-meta">{context.category || "News"} · {coveredMaterial}</p>
              <ol className="summary-list">
                {context.summary.map((sentence, index) => (
                  <li key={`${index}-${sentence}`}>{sentence}</li>
                ))}
              </ol>
              <div className="material-counts">
                <div><strong>{context.quiz.length}</strong><span>TRUE / FALSE</span></div>
                <div><strong>{context.blanks.length}</strong><span>VOCAB BLANKS</span></div>
              </div>
              <div className="word-list">
                {context.vocabulary.slice(0, 8).map((item) => (
                  <span key={item.word}>{item.word}</span>
                ))}
              </div>
            </>
          ) : (
            <div className="no-material">
              <h2 id="material-title">학습자료를 기다리고 있습니다</h2>
              <p>Daily English Hub의 Section 6 버튼에서 접근 코드를 인증해 열어주세요.</p>
            </div>
          )}

          <div className="privacy-note">
            <strong>EPHEMERAL SESSION</strong>
            <p>원본 음성은 저장하지 않습니다. 현재 탭의 학습자료와 자막만 메모리에 유지됩니다.</p>
            {tokenUsage !== null && <small>이번 연결 누적 토큰: {tokenUsage.toLocaleString()}</small>}
          </div>
        </aside>
      </div>
    </main>
  );
}
