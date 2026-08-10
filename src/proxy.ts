import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 매 요청마다 Supabase 세션 토큰을 갱신한다(만료된 access token을 refresh token으로 재발급).
 * 이게 없으면 로그인 후 시간이 지났을 때 서버 컴포넌트/라우트 핸들러에서
 * 세션이 조용히 만료된 것처럼 보일 수 있다.
 *
 * Next.js 16부터 middleware.ts가 proxy.ts로 이름이 바뀌었다(동작은 동일).
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 환경변수가 아직 설정되지 않았다면(.env.local 미설정) 세션 갱신만 건너뛴다 —
  // proxy는 모든 요청에 걸리므로 여기서 throw하면 사이트 전체가 죽는다.
  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
