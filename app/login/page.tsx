'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/')
      }
    })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('회원가입 완료! 이메일 인증이 필요할 수 있습니다. 로그인해주세요.')
        setMode('login')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/')
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex flex-col min-h-screen items-center justify-center px-6 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/hero/woorae.jpg')" }}
      />
      <div className="absolute inset-0 bg-wood-bg/90" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-2">
          <h1 className="ink-wash-title ink-wash-title--sm">
            <span>평양냉면 혼자 먹기</span>
          </h1>
        </div>
        <p className="text-wood-muted text-center mb-8">
          {mode === 'login' ? '로그인하고 나만의 목록을 관리하세요' : '회원가입하고 시작하세요'}
        </p>

        <div className="bg-wood-surface border-t-4 border-wood-wood rounded-sm shadow-md p-8">
          {error && (
            <div className="p-3 mb-4 bg-wood-error-bg rounded-sm border border-wood-error-border">
              <p className="text-wood-error-ink text-sm">{error}</p>
            </div>
          )}
          {message && (
            <div className="p-3 mb-4 bg-wood-success-bg rounded-sm border border-wood-success-border">
              <p className="text-wood-success-ink text-sm">{message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-wood-ink mb-2">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-2 border border-wood-border-strong rounded-sm bg-wood-surface text-wood-ink placeholder-wood-muted focus:outline-none focus:ring-2 focus:ring-wood-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-wood-ink mb-2">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="6자 이상"
                className="w-full px-4 py-2 border border-wood-border-strong rounded-sm bg-wood-surface text-wood-ink placeholder-wood-muted focus:outline-none focus:ring-2 focus:ring-wood-accent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-wood-accent hover:bg-wood-accent-hover disabled:bg-wood-accent/50 text-wood-accent-ink font-medium rounded-sm transition-colors"
            >
              {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
            </button>
          </form>

          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError(null)
              setMessage(null)
            }}
            className="w-full mt-4 text-sm text-wood-muted hover:underline"
          >
            {mode === 'login' ? '계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}
          </button>
        </div>

        <p className="text-center text-xs text-wood-muted mt-6">
          테스트 계정 &nbsp;demo@pynm.com&nbsp;/&nbsp;demo1234
        </p>
      </div>
    </div>
  )
}
