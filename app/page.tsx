'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Restaurant {
  id: number
  name: string
  food: string
  rating: number | null
  created_at: string
  district: string
  price: number | null
  solo_status: string
}

export default function Home() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const response = await fetch('/api/restaurants')
        const data = await response.json()
        setRestaurants(data)
      } catch (error) {
        console.error('Failed to fetch restaurants:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurants()
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black">
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        <div className="flex items-start justify-between mb-12">
          <div>
            <h1 className="text-4xl font-bold text-black dark:text-white mb-2">
              🍽️ 맛집 추천
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              최고의 맛집들을 발견하세요
            </p>
          </div>
          <Link
            href="/restaurants/new"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            + 식당 등록
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-zinc-600 dark:text-zinc-400">로딩 중...</p>
          </div>
        ) : restaurants.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-600 dark:text-zinc-400">
              등록된 맛집이 없습니다.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {restaurants.map((restaurant) => (
              <div
                key={restaurant.id}
                className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-xl font-semibold text-black dark:text-white">
                    {restaurant.name}
                  </h2>
                  {restaurant.rating && (
                    <div className="bg-yellow-100 dark:bg-yellow-900 px-3 py-1 rounded-full">
                      <span className="text-sm font-medium text-yellow-800 dark:text-yellow-100">
                        ⭐ {restaurant.rating}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                  {restaurant.district}
                </p>
                <p className="text-lg text-zinc-700 dark:text-zinc-300 mb-2">
                  🍜 {restaurant.food}
                  {restaurant.price ? ` · ${restaurant.price.toLocaleString()}원` : ''}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  {restaurant.solo_status}
                </p>
                <Link
                  href={`/restaurants/${restaurant.id}`}
                  className="mt-auto text-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-black dark:text-white text-sm font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  상세보기
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
