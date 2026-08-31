'use client'

import { useState } from 'react'
import { authFetch } from '@/lib/authFetch'

interface RatingInputProps {
  id: number
  rating: number | null
  onChange: (rating: number | null) => void
}

export default function RatingInput({ id, rating, onChange }: RatingInputProps) {
  const [loading, setLoading] = useState(false)

  const handleSelect = async (value: number) => {
    setLoading(true)
    try {
      const nextRating = rating === value ? null : value
      const response = await authFetch(`/api/restaurants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: nextRating }),
      })

      if (!response.ok) {
        throw new Error('별점 저장에 실패했습니다.')
      }

      const data = await response.json()
      onChange(data.rating)
    } catch (err) {
      alert(err instanceof Error ? err.message : '별점 저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          disabled={loading}
          onClick={() => handleSelect(value)}
          aria-label={`${value}점`}
          className={`text-2xl leading-none disabled:opacity-50 ${
            rating && value <= rating ? 'text-wood-accent' : 'text-wood-border-strong'
          }`}
        >
          {rating && value <= rating ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}
