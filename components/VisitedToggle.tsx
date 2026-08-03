'use client'

import { useState } from 'react'
import { authFetch } from '@/lib/authFetch'

interface VisitedToggleProps {
  id: number
  visited: boolean
  onChange: (visited: boolean) => void
}

export default function VisitedToggle({ id, visited, onChange }: VisitedToggleProps) {
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    try {
      const response = await authFetch(`/api/restaurants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visited: !visited }),
      })

      if (!response.ok) {
        throw new Error('방문 상태 변경에 실패했습니다.')
      }

      const data = await response.json()
      onChange(data.visited)
    } catch (err) {
      alert(err instanceof Error ? err.message : '방문 상태 변경에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`px-6 py-3 font-medium rounded-sm transition-colors ${
        visited
          ? 'bg-wood-sage hover:bg-wood-sage-hover text-wood-accent-ink'
          : 'border border-wood-border-strong text-wood-ink hover:bg-wood-bg'
      }`}
    >
      {loading ? '처리 중...' : visited ? '✅ 다녀왔어요' : '다녀왔어요'}
    </button>
  )
}
