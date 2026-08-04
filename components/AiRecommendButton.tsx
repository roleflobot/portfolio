'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SEOUL_DISTRICTS } from '@/lib/districts'
import { authFetch } from '@/lib/authFetch'
import { AI_RECOMMEND_DRAFT_KEY } from '@/lib/aiRecommendDraft'

export default function AiRecommendButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [district, setDistrict] = useState('')
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setOpen(false)
    setDistrict('')
    setLoading(false)
    setNotFound(false)
    setError(null)
  }

  const handleRecommend = async () => {
    if (!district) return
    setLoading(true)
    setNotFound(false)
    setError(null)

    try {
      const response = await authFetch('/api/restaurants/ai-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ district }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'AI 추천에 실패했습니다.')
      }

      if (!data.found) {
        setNotFound(true)
        setLoading(false)
        return
      }

      sessionStorage.setItem(
        AI_RECOMMEND_DRAFT_KEY,
        JSON.stringify({
          name: data.name,
          district: data.district,
          address: data.address,
          price: data.price,
          solo_status: data.solo_status,
          photo_url: data.photo_url,
        })
      )
      router.push('/restaurants/new')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 추천에 실패했습니다.')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-6 py-3 border border-wood-border-strong text-wood-ink font-medium rounded-sm hover:bg-wood-surface transition-colors whitespace-nowrap"
      >
        AI 추천
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
          onClick={close}
        >
          <div
            className="bg-wood-surface border-t-4 border-wood-wood rounded-sm shadow-md p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-wood-ink mb-2">AI 추천</h2>
            <p className="text-sm text-wood-muted mb-4">
              자치구를 고르면 AI가 그 지역에서 혼밥 가능한 평양냉면집을 검색해서 등록 폼을 채워드려요.
            </p>

            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2 border border-wood-border-strong rounded-sm bg-wood-surface text-wood-ink focus:outline-none focus:ring-2 focus:ring-wood-accent mb-3"
            >
              <option value="">자치구를 선택하세요</option>
              {SEOUL_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {notFound && (
              <p className="text-sm text-wood-danger mb-3">
                이 자치구에서는 혼밥 가능한 평양냉면집을 찾지 못했어요. 다른 자치구를 선택해보세요.
              </p>
            )}
            {error && <p className="text-sm text-wood-danger mb-3">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleRecommend}
                disabled={!district || loading}
                className="flex-1 px-4 py-2 bg-wood-accent hover:bg-wood-accent-hover disabled:bg-wood-accent/50 text-wood-accent-ink font-medium rounded-sm transition-colors"
              >
                {loading ? '검색 중...' : '추천 받기'}
              </button>
              <button
                onClick={close}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-wood-border-strong text-wood-ink font-medium rounded-sm hover:bg-wood-bg transition-colors disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
