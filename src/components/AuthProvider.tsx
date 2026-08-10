"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type AuthContextValue = {
  /** 익명 사용자를 포함해, 세션이 있으면 항상 채워진다. */
  user: User | null;
  /** true면 구글/이메일 로그인이 아닌 익명(게스트) 세션이다. */
  isGuest: boolean;
  nickname: string | null;
  loading: boolean;
  setNickname: (nickname: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isGuest: false,
  nickname: null,
  loading: true,
  setNickname: async () => {},
});

function extractNickname(user: User | null): string | null {
  const value = user?.user_metadata?.nickname;
  return typeof value === "string" && value.trim() ? value : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      const { data } = await supabase.auth.getUser();

      if (data.user) {
        setUser(data.user);
      } else {
        // 세션이 아예 없는 첫 방문 — 익명으로 로그인해 이후 모든 학습 기록을
        // 이 방문자만의 것으로 안정적으로 식별할 수 있게 한다.
        const { data: anon, error } = await supabase.auth.signInAnonymously();
        if (error) console.error("[AuthProvider] anonymous sign-in failed", error);
        setUser(anon.user ?? null);
      }
      setLoading(false);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function setNickname(nickname: string) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.updateUser({ data: { nickname } });
    if (error) throw error;
    setUser(data.user);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isGuest: !!user?.is_anonymous,
        nickname: extractNickname(user),
        loading,
        setNickname,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
