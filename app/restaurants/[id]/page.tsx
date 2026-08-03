'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

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
}

export default function RestaurantDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const response = await fetch(`/api/restaurants/${id}`)
        if (!response.ok) {
          throw new Error('식당 정보를 불러오지 못했습니다.')
        }
        const data = await response.json()
        setRestaurant(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurant()
  }, [id])

  const handleDelete = async () => {
    if (!confirm('정말 이 식당을 삭제하시겠습니까?')) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/restaurants/${id}`, {
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

  if (loading) {
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
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
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
              <dt className="text-sm text-zinc-500 dark:text-zinc-400">방문 여부</dt>
              <dd className="text-black dark:text-white">
                {restaurant.visited ? '다녀왔어요' : '아직 안 가봤어요'}
              </dd>
            </div>
            {restaurant.visited && (
              <div>
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">개인 별점</dt>
                <dd className="text-black dark:text-white">
                  {restaurant.rating ? `⭐ ${restaurant.rating} / 5` : '미입력'}
                </dd>
              </div>
            )}
            {restaurant.memo && (
              <div>
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">메모</dt>
                <dd className="text-black dark:text-white whitespace-pre-wrap">
                  {restaurant.memo}
                </dd>
              </div>
            )}
          </dl>

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
      </main>
    </div>
  )
}
