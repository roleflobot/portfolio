'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SEOUL_DISTRICTS } from '@/lib/districts'
import { authFetch } from '@/lib/authFetch'
import { useAuthGuard } from '@/lib/useAuthGuard'
import { supabase } from '@/lib/supabase'

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
  const router = useRouter()
  const session = useAuthGuard()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'want' | 'visited'>('all')
  const [district, setDistrict] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!session) return

    const fetchRestaurants = async () => {
      setLoading(true)
      try {
        const searchParams = new URLSearchParams()
        if (tab !== 'all') {
          searchParams.set('visited', tab === 'visited' ? 'true' : 'false')
        }
        if (district) {
          searchParams.set('district', district)
        }

        const response = await authFetch(`/api/restaurants?${searchParams.toString()}`)
        const data = await response.json()
        setRestaurants(data)
      } catch (error) {
        console.error('Failed to fetch restaurants:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurants()
  }, [session, tab, district])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (!session) {
    return null
  }

  const filteredRestaurants = restaurants.filter((restaurant) =>
    restaurant.name.toLowerCase().includes(search.trim().toLowerCase())
  )

  const pricedRestaurants = filteredRestaurants.filter(
    (r): r is Restaurant & { price: number } => r.price != null
  )
  const averagePrice =
    pricedRestaurants.length > 0
      ? Math.round(
          pricedRestaurants.reduce((sum, r) => sum + r.price, 0) / pricedRestaurants.length
        )
      : null

  return (
    <div className="flex flex-col min-h-screen bg-wood-bg">
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-wood-ink mb-2">
              🍜 평양냉면 혼밥 도장깨기
            </h1>
            <p className="text-lg text-wood-muted">
              서울의 1인 식사 가능한 평양냉면집을 저장하고 혼밥 도장을 깨보세요
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/restaurants/new"
              className="px-6 py-3 bg-wood-accent hover:bg-wood-accent-hover text-wood-accent-ink font-medium rounded-sm transition-colors whitespace-nowrap"
            >
              + 식당 등록
            </Link>
            <button
              onClick={handleLogout}
              className="px-6 py-3 border border-wood-border-strong text-wood-ink font-medium rounded-sm hover:bg-wood-surface transition-colors whitespace-nowrap"
            >
              로그아웃
            </button>
          </div>
        </div>

        {averagePrice !== null && (
          <p className="text-sm text-wood-muted mb-4">
            평균 냉면 가격 <span className="font-semibold text-wood-ink">{averagePrice.toLocaleString()}원</span>
            {' '}({pricedRestaurants.length}곳 기준)
          </p>
        )}

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('all')}
            className={`px-5 py-2 rounded-sm font-medium transition-colors ${
              tab === 'all'
                ? 'bg-wood-wood text-wood-surface'
                : 'bg-wood-surface text-wood-ink border border-wood-border-strong'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setTab('want')}
            className={`px-5 py-2 rounded-sm font-medium transition-colors ${
              tab === 'want'
                ? 'bg-wood-wood text-wood-surface'
                : 'bg-wood-surface text-wood-ink border border-wood-border-strong'
            }`}
          >
            가고 싶은 곳
          </button>
          <button
            onClick={() => setTab('visited')}
            className={`px-5 py-2 rounded-sm font-medium transition-colors ${
              tab === 'visited'
                ? 'bg-wood-wood text-wood-surface'
                : 'bg-wood-surface text-wood-ink border border-wood-border-strong'
            }`}
          >
            다녀온 곳
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="px-4 py-2 border border-wood-border-strong rounded-sm bg-wood-surface text-wood-ink focus:outline-none focus:ring-2 focus:ring-wood-accent"
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
            className="flex-1 min-w-[200px] px-4 py-2 border border-wood-border-strong rounded-sm bg-wood-surface text-wood-ink placeholder-wood-muted focus:outline-none focus:ring-2 focus:ring-wood-accent"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-wood-muted">로딩 중...</p>
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-wood-muted">
              {tab === 'all'
                ? '등록된 식당이 없습니다.'
                : tab === 'want'
                  ? '가고 싶은 곳이 없습니다.'
                  : '다녀온 곳이 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredRestaurants.map((restaurant) => (
              <div
                key={restaurant.id}
                className="bg-wood-surface border border-wood-border rounded-sm shadow-md p-6 hover:shadow-lg transition-shadow flex flex-col"
              >
                <h2 className="text-xl font-semibold text-wood-ink mb-2">
                  {restaurant.name}
                </h2>
                {restaurant.rating && (
                  <div className="mb-3">
                    <span className="inline-block bg-wood-badge-bg px-3 py-1 rounded-sm text-sm font-medium text-wood-badge-ink">
                      ⭐ {restaurant.rating}
                    </span>
                  </div>
                )}
                <p className="text-sm text-wood-muted mb-1">
                  {restaurant.district}
                </p>
                <p className="text-lg text-wood-ink mb-2">
                  🍜 {restaurant.food}
                  {restaurant.price ? ` · ${restaurant.price.toLocaleString()}원` : ''}
                </p>
                <p className="text-sm text-wood-muted mb-4">
                  {restaurant.solo_status}
                </p>
                <Link
                  href={`/restaurants/${restaurant.id}`}
                  className="mt-auto text-center px-4 py-2 border border-wood-border-strong text-wood-ink text-sm font-medium rounded-sm hover:bg-wood-bg transition-colors"
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
