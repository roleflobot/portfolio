"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import LoginOptions from "@/components/LoginOptions";

export default function AuthWidget() {
  const supabase = createClient();
  const { user, isGuest, nickname, loading } = useAuth();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    setOpen(false);
  }

  if (loading) {
    return <div className="font-mono text-xs text-ink-faint">···</div>;
  }

  if (user && !isGuest) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="font-mono text-xs text-ink-soft">{user.email ?? "로그인됨"}</span>
        <button
          onClick={handleLogout}
          className="rounded-sm border border-border-strong px-3 py-1 font-mono text-xs uppercase hover:bg-surface-2"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-sm border border-border-strong px-3 py-1 font-mono text-xs uppercase hover:bg-surface-2"
      >
        {nickname ? `게스트 · ${nickname}` : "로그인"}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-sm border border-border bg-surface p-4 shadow-lg">
          <div className="mb-3 flex items-start justify-between gap-2">
            <p className="text-xs text-ink-faint">
              로그인하면 기기가 바뀌어도 학습 기록을 이어볼 수 있어요.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="닫기"
              className="shrink-0 text-ink-faint hover:text-ink"
            >
              ✕
            </button>
          </div>
          <LoginOptions onSuccess={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
