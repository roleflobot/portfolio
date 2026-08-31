"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";

type Mode = "signin" | "signup";

export default function LoginOptions({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const supabase = createClient();
  const { isGuest } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOAuth(provider: "google") {
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback`;

    if (isGuest) {
      // 게스트(익명 계정) 상태면 새 계정으로 갈아타지 않고, 지금 계정에 구글을 연결해
      // 그동안 쌓인 학습 기록(같은 user_id)이 그대로 이어지게 한다.
      const { error } = await supabase.auth.linkIdentity({ provider, options: { redirectTo } });
      if (error) {
        // 프로젝트에서 Manual Linking이 꺼져 있으면 여기로 온다 — 기록 이어받기는
        // 못 해도 로그인 자체는 되도록 일반 로그인으로 폴백한다.
        const { error: fallbackError } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo },
        });
        if (fallbackError) setError(fallbackError.message);
      }
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) setError(error.message);
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("이메일과 비밀번호를 모두 입력해주세요.");
      return;
    }

    setPending(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        onSuccess?.();
      } else if (isGuest) {
        // 게스트(익명 계정) 상태면 새 계정을 만들지 않고, 지금 계정에 이메일/비밀번호를
        // 채워 넣어 그동안 쌓인 학습 기록(같은 user_id)이 그대로 이어지게 한다.
        // 프로젝트의 Supabase 이메일 인증(Confirm email)이 꺼져 있어 이 호출과 동시에
        // 바로 로그인 상태가 되므로, signin과 동일하게 즉시 onSuccess로 진행한다.
        const { error } = await supabase.auth.updateUser({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        onSuccess?.();
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="space-y-2">
        <button
          onClick={() => handleOAuth("google")}
          className="flex w-full items-center justify-center gap-2 rounded-sm border border-border-strong px-3 py-2 text-sm hover:bg-surface-2"
        >
          <Image src="/google-logo.png" alt="" width={18} height={18} />
          Google로 로그인
        </button>
      </div>

      <div className="my-3 flex items-center gap-2 font-mono text-[0.7rem] text-ink-faint uppercase">
        <div className="h-px flex-1 bg-border" />
        또는 이메일
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmailSubmit} className="space-y-2">
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-sm border border-border-strong px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-sm border border-border-strong px-3 py-2 text-sm"
        />

        {error && <p className="text-xs text-danger">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-sm border border-accent bg-accent-tint px-3 py-2 font-mono text-xs text-accent-ink uppercase disabled:opacity-50"
        >
          {pending ? "처리 중..." : mode === "signin" ? "로그인" : "회원가입"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "signin" ? "signup" : "signin"));
            setError(null);
          }}
          className="w-full text-xs text-ink-faint underline"
        >
          {mode === "signin" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
        </button>
      </form>
    </div>
  );
}
