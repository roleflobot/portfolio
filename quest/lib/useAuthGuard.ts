'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

/**
 * 로그인하지 않은 사용자를 /login으로 보낸다.
 * 반환값이 undefined면 세션 확인 중, null이면 리다이렉트 진행 중이다.
 */
export function useAuthGuard() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => {
        if (!data.session) {
          router.replace('/login')
        }
        setSession(data.session)
      })
      .catch(() => {
        router.replace('/login')
      })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!newSession) {
        router.replace('/login')
      }
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [router])

  return session
}
