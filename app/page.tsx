'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SEOUL_DISTRICTS } from '@/lib/districts'

interface Restaurant {
  id: number
  name: string
  food: string
  rating: number | null
  created_at: string
  district: string
  price: number | null
  solo_status: string
  visited: boolean
}

export default function Home() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'want' | 'visited'>('want')
  const [district, setDistrict] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchRestaurants = async () => {
      setLoading(true)
      try {
        const searchParams = new URLSearchParams()
        searchParams.set('visited', tab === 'visited' ? 'true' : 'false')
        if (district) {
          searchParams.set('district', district)
        }

        const response = await fetch(`/api/restaurants?${searchParams.toString()}`)
        const data = await response.json()
        setRestaurants(data)
      } catch (error) {
        console.error('Failed to fetch restaurants:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurants()
  }, [tab, district])

  const filteredRestaurants = restaurants.filter((restaurant) =>
    restaurant.name.toLowerCase().includes(search.trim().toLowerCase())
  )

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black">
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-black dark:text-white mb-2">
              🍜 평양냉면 혼밥 도장깨기
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              서울의 평양냉면집을 저장하고 혼밥 도장을 깨보세요
            </p>
          </div>
          <Link
            href="/restaurants/new"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            + 식당 등록
          </Link>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('want')}
            className={`px-5 py-2 rounded-lg font-medium transition-colors ${
              tab === 'want'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-zinc-900 text-black dark:text-white border border-gray-300 dark:border-gray-600'
            }`}
          >
            가고 싶은 곳
          </button>
          <button
            onClick={() => setTab('visited')}
            className={`px-5 py-2 rounded-lg font-medium transition-colors ${
              tab === 'visited'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-zinc-900 text-black dark:text-white border border-gray-300 dark:border-gray-600'
            }`}
          >
            다녀온 곳
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 자치구</option>
            {SEOUL_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="식당명 검색"
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-zinc-600 dark:text-zinc-400">로딩 중...</p>
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-600 dark:text-zinc-400">
              {tab === 'want' ? '가고 싶은 곳이 없습니다.' : '다녀온 곳이 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredRestaurants.map((restaurant) => (
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
