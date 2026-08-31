import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Google/Kakao OAuth 로그인 후 Supabase가 리다이렉트해오는 콜백.
 * PKCE code를 세션으로 교환한다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] exchangeCodeForSession failed", error);
  }

  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
