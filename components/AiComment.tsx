'use client'

import { useState } from 'react'
import { authFetch } from '@/lib/authFetch'

interface AiCommentProps {
  id: number
  comment: string | null
  onChange: (comment: string) => void
}

export default function AiComment({ id, comment, onChange }: AiCommentProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await authFetch(`/api/restaurants/${id}/ai-comment`, {
        method: 'POST',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'AI 리뷰요약 생성에 실패했습니다.')
      }

      onChange(data.ai_comment)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 리뷰요약 생성에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {comment && <p className="text-wood-ink italic mb-2">{comment}</p>}
      {error && <p className="text-sm text-wood-danger mb-2">{error}</p>}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="px-4 py-2 border border-wood-border-strong text-wood-ink text-sm font-medium rounded-sm hover:bg-wood-bg disabled:opacity-50 transition-colors"
      >
        {loading ? '작성 중...' : comment ? 'AI 리뷰요약 다시 만들기' : 'AI 리뷰요약 만들기'}
      </button>
    </div>
  )
}
