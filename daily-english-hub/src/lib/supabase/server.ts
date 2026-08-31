import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

/**
 * Route Handler / Server Component에서 사용하는 Supabase 클라이언트.
 * 요청의 쿠키에서 로그인 세션을 읽어 auth.uid()가 RLS 정책에 반영되도록 한다.
 */
export async function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component에서 호출되면 쓰기가 무시될 수 있다.
          // 세션 갱신은 proxy.ts가 담당하므로 문제되지 않는다.
        }
      },
    },
  });
}
