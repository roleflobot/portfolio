'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import VisitedToggle from '@/components/VisitedToggle'
import RatingInput from '@/components/RatingInput'
import RestaurantPhoto from '@/components/RestaurantPhoto'
import AiComment from '@/components/AiComment'
import { authFetch } from '@/lib/authFetch'
import { useAuthGuard } from '@/lib/useAuthGuard'

interface Restaurant {
  id: number
  name: string
  district: string
  address: string | null
  price: number | null
  solo_status: string
  visited: boolean
  rating: number | null
  memo: string | null
  map_url: string | null
  naver_map_url: string | null
  photo_url: string | null
  ai_comment: string | null
}

export default function RestaurantDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const session = useAuthGuard()

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [memoDraft, setMemoDraft] = useState('')
  const [savingMemo, setSavingMemo] = useState(false)

  useEffect(() => {
    if (!session) return

    const fetchRestaurant = async () => {
      try {
        const response = await authFetch(`/api/restaurants/${id}`)
        if (!response.ok) {
          throw new Error('식당 정보를 불러오지 못했습니다.')
        }
        const data = await response.json()
        setRestaurant(data)
        setMemoDraft(data.memo || '')
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurant()
  }, [session, id])

  const handleSaveMemo = async () => {
    setSavingMemo(true)
    try {
      const response = await authFetch(`/api/restaurants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo: memoDraft }),
      })

      if (!response.ok) {
        throw new Error('후기 저장에 실패했습니다.')
      }

      const data = await response.json()
      setRestaurant((prev) => (prev ? { ...prev, memo: data.memo } : prev))
    } catch (err) {
      alert(err instanceof Error ? err.message : '후기 저장에 실패했습니다.')
    } finally {
      setSavingMemo(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('정말 이 식당을 삭제하시겠습니까?')) {
      return
    }

    setDeleting(true)
    try {
      const response = await authFetch(`/api/restaurants/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('삭제에 실패했습니다.')
      }

      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
      setDeleting(false)
    }
  }

  if (!session || loading) {
    return (
      <div className="flex flex-col min-h-screen bg-wood-bg">
        <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
          <p className="text-center text-wood-muted">로딩 중...</p>
        </main>
      </div>
    )
  }

  if (error || !restaurant) {
    return (
      <div className="flex flex-col min-h-screen bg-wood-bg">
        <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
          <p className="text-center text-wood-danger mb-6">
            {error || '식당을 찾을 수 없습니다.'}
          </p>
          <Link
            href="/"
            className="block text-center px-6 py-3 border border-wood-border-strong text-wood-ink font-medium rounded-sm hover:bg-wood-surface transition-colors"
          >
            목록으로
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-wood-bg">
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        <div className="bg-wood-surface border-t-4 border-wood-wood rounded-sm shadow-md p-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-wood-ink mb-1">
              {restaurant.name}
            </h1>
            <p className="text-wood-muted">{restaurant.district}</p>
          </div>

          <div className="flex gap-6">
            <dl className="flex-1 space-y-4">
              <div>
                <dt className="text-sm text-wood-muted">주소</dt>
                <dd className="text-wood-ink">
                  {restaurant.address || '등록된 주소가 없습니다.'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-wood-muted">평양냉면 가격</dt>
                <dd className="text-wood-ink">
                  {restaurant.price ? `${restaurant.price.toLocaleString()}원` : '미확인'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-wood-muted">혼밥 가능 여부</dt>
                <dd className="text-wood-ink">{restaurant.solo_status}</dd>
              </div>
              <div>
                <dt className="text-sm text-wood-muted mb-2">방문 여부</dt>
                <dd>
                  <VisitedToggle
                    id={restaurant.id}
                    visited={restaurant.visited}
                    onChange={(visited) =>
                      setRestaurant((prev) =>
                        prev ? { ...prev, visited, rating: visited ? prev.rating : null } : prev
                      )
                    }
                  />
                </dd>
              </div>
              <div>
                <dt className="text-sm text-wood-muted mb-2">개인 별점</dt>
                <dd>
                  <RatingInput
                    id={restaurant.id}
                    rating={restaurant.rating}
                    onChange={(rating) =>
                      setRestaurant((prev) =>
                        prev ? { ...prev, rating, visited: rating ? true : prev.visited } : prev
                      )
                    }
                  />
                </dd>
              </div>
            </dl>
            <div className="w-64 flex-shrink-0">
              <RestaurantPhoto
                id={restaurant.id}
                photoUrl={restaurant.photo_url}
                onChange={(photo_url) =>
                  setRestaurant((prev) => (prev ? { ...prev, photo_url } : prev))
                }
              />
            </div>
          </div>

          {restaurant.visited && (
            <div>
              <label className="block text-sm text-wood-muted mb-2">
                AI 리뷰요약
              </label>
              <AiComment
                id={restaurant.id}
                comment={restaurant.ai_comment}
                onChange={(ai_comment) =>
                  setRestaurant((prev) => (prev ? { ...prev, ai_comment } : prev))
                }
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-wood-muted mb-2">
              실제 방문 후기
            </label>
            <textarea
              value={memoDraft}
              onChange={(e) => setMemoDraft(e.target.value)}
              rows={3}
              placeholder="직접 가본 뒤의 후기를 남겨보세요"
              className="w-full px-4 py-2 border border-wood-border-strong rounded-sm bg-wood-surface text-wood-ink placeholder-wood-muted focus:outline-none focus:ring-2 focus:ring-wood-accent mb-2"
            />
            <button
              onClick={handleSaveMemo}
              disabled={savingMemo || memoDraft === (restaurant.memo || '')}
              className="px-4 py-2 bg-wood-accent hover:bg-wood-accent-hover disabled:bg-wood-accent/40 disabled:cursor-not-allowed text-wood-accent-ink text-sm font-medium rounded-sm transition-colors"
            >
              {savingMemo ? '저장 중...' : '후기 저장'}
            </button>
          </div>

          {restaurant.map_url && (
            <a
              href={restaurant.map_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center px-6 py-3 bg-wood-sage hover:bg-wood-sage-hover text-wood-accent-ink font-medium rounded-sm transition-colors"
            >
              네이버 지도에서 보기
            </a>
          )}

          <div className="flex gap-3 pt-4 border-t border-wood-border">
            <Link
              href="/"
              className="flex-1 text-center px-6 py-3 border border-wood-border-strong text-wood-ink font-medium rounded-sm hover:bg-wood-bg transition-colors"
            >
              목록
            </Link>
            <Link
              href={`/restaurants/${restaurant.id}/edit`}
              className="flex-1 text-center px-6 py-3 bg-wood-wood hover:opacity-90 text-wood-surface font-medium rounded-sm transition-colors"
            >
              수정
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-6 py-3 border border-wood-border-strong text-wood-danger hover:bg-wood-error-bg disabled:opacity-50 font-medium rounded-sm transition-colors"
            >
              {deleting ? '삭제 중...' : '삭제'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
