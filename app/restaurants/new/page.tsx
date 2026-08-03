'use client'

import RestaurantForm from '@/components/RestaurantForm'
import { useAuthGuard } from '@/lib/useAuthGuard'

export default function NewRestaurantPage() {
  const session = useAuthGuard()

  if (!session) {
    return null
  }

  return (
    <div className="flex flex-col min-h-screen bg-wood-bg">
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-wood-ink mb-2">
            새 맛집 등록
          </h1>
          <p className="text-lg text-wood-muted">
            발견한 맛집을 추천해주세요
          </p>
        </div>

        <div className="bg-wood-surface border-t-4 border-wood-wood rounded-sm shadow-md p-8">
          <RestaurantForm />
        </div>
      </main>
    </div>
  )
}
