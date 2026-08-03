'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import VisitedToggle from '@/components/VisitedToggle'
import RatingInput from '@/components/RatingInput'
import MiniMap from '@/components/MiniMap'
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
  lat: number | null
  lng: number | null
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
        throw new Error('메모 저장에 실패했습니다.')
      }

      const data = await response.json()
      setRestaurant((prev) => (prev ? { ...prev, memo: data.memo } : prev))
    } catch (err) {
      alert(err instanceof Error ? err.message : '메모 저장에 실패했습니다.')
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
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black">
        <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
          <p className="text-center text-zinc-600 dark:text-zinc-400">로딩 중...</p>
        </main>
      </div>
    )
  }

  if (error || !restaurant) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black">
        <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
          <p className="text-center text-red-600 dark:text-red-400 mb-6">
            {error || '식당을 찾을 수 없습니다.'}
          </p>
          <Link
            href="/"
            className="block text-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-black dark:text-white font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            목록으로
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black">
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        <div className="grid gap-6 md:grid-cols-[1fr_320px] items-start">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-black dark:text-white mb-1">
              {restaurant.name}
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">{restaurant.district}</p>
          </div>

          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-zinc-500 dark:text-zinc-400">주소</dt>
              <dd className="text-black dark:text-white">
                {restaurant.address || '등록된 주소가 없습니다.'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500 dark:text-zinc-400">평양냉면 가격</dt>
              <dd className="text-black dark:text-white">
                {restaurant.price ? `${restaurant.price.toLocaleString()}원` : '미확인'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500 dark:text-zinc-400">혼밥 가능 여부</dt>
              <dd className="text-black dark:text-white">{restaurant.solo_status}</dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">방문 여부</dt>
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
              <dt className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">개인 별점</dt>
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

          <div>
            <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-2">
              메모
            </label>
            <textarea
              value={memoDraft}
              onChange={(e) => setMemoDraft(e.target.value)}
              rows={3}
              placeholder="혼밥 경험이나 한 줄 메모를 남겨보세요"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            />
            <button
              onClick={handleSaveMemo}
              disabled={savingMemo || memoDraft === (restaurant.memo || '')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {savingMemo ? '저장 중...' : '메모 저장'}
            </button>
          </div>

          {restaurant.map_url && (
            <a
              href={restaurant.map_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              네이버 지도에서 보기
            </a>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Link
              href="/"
              className="flex-1 text-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-black dark:text-white font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              목록
            </Link>
            <Link
              href={`/restaurants/${restaurant.id}/edit`}
              className="flex-1 text-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              수정
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg transition-colors"
            >
              {deleting ? '삭제 중...' : '삭제'}
            </button>
          </div>
        </div>

        {restaurant.lat != null && restaurant.lng != null && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-4 md:sticky md:top-8">
            <MiniMap lat={restaurant.lat} lng={restaurant.lng} name={restaurant.name} />
          </div>
        )}
        </div>
      </main>
    </div>
  )
}
