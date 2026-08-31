import { createClient, type User } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * 요청의 Authorization 헤더(로그인 사용자의 access token)를 그대로 Supabase에 전달한다.
 * 이렇게 해야 RLS 정책의 auth.uid()가 요청한 사용자로 평가된다.
 */
export function getSupabaseForRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || ''

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
}

export async function getRequestUser(
  request: NextRequest
): Promise<{ user: User | null; supabase: ReturnType<typeof getSupabaseForRequest> }> {
  const supabase = getSupabaseForRequest(request)
  const { data } = await supabase.auth.getUser()
  return { user: data.user, supabase }
}
