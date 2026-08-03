'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import RestaurantForm from '@/components/RestaurantForm'
import { authFetch } from '@/lib/authFetch'
import { useAuthGuard } from '@/lib/useAuthGuard'

interface Restaurant {
  id: number
  name: string
  district: string
  address: string | null
  price: number | null
  solo_status: string
  map_url: string | null
  naver_place_name: string | null
  naver_category: string | null
  naver_road_address: string | null
  naver_mapx: number | null
  naver_mapy: number | null
  naver_link_source: string | null
}

export default function EditRestaurantPage() {
  const params = useParams()
  const id = params.id as string
  const session = useAuthGuard()

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurant()
  }, [session, id])

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
          <p className="text-center text-wood-danger">
            {error || '식당을 찾을 수 없습니다.'}
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-wood-bg">
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-wood-ink mb-2">
            맛집 수정
          </h1>
          <p className="text-wood-muted">
            {restaurant.name} 정보를 수정합니다
          </p>
        </div>

        <div className="bg-wood-surface border-t-4 border-wood-wood rounded-sm shadow-md p-8">
          <RestaurantForm
            isEditing
            initialData={{
              id: restaurant.id,
              name: restaurant.name,
              district: restaurant.district,
              address: restaurant.address || '',
              price: restaurant.price || 0,
              solo_status: restaurant.solo_status,
              map_url: restaurant.map_url || '',
              naver_place_name: restaurant.naver_place_name || '',
              naver_category: restaurant.naver_category || '',
              naver_road_address: restaurant.naver_road_address || '',
              naver_mapx: restaurant.naver_mapx,
              naver_mapy: restaurant.naver_mapy,
              naver_link_source: restaurant.naver_link_source || '',
            }}
          />
        </div>
      </main>
    </div>
  )
}
