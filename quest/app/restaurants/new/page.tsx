'use client'

import { useEffect, useState } from 'react'
import RestaurantForm from '@/components/RestaurantForm'
import { useAuthGuard } from '@/lib/useAuthGuard'
import { AI_RECOMMEND_DRAFT_KEY, type AiRecommendDraft } from '@/lib/aiRecommendDraft'

export default function NewRestaurantPage() {
  const session = useAuthGuard()
  const [draft, setDraft] = useState<AiRecommendDraft | null>(null)
  const [draftLoaded, setDraftLoaded] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem(AI_RECOMMEND_DRAFT_KEY)
    sessionStorage.removeItem(AI_RECOMMEND_DRAFT_KEY)
    if (raw) {
      try {
        setDraft(JSON.parse(raw))
      } catch {
        setDraft(null)
      }
    }
    setDraftLoaded(true)
  }, [])

  if (!session || !draftLoaded) {
    return null
  }

  return (
    <div className="flex flex-col min-h-screen bg-wood-bg">
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-wood-ink mb-2">
            새 평양냉면집 등록
          </h1>
          <p className="text-lg text-wood-muted">
            {draft
              ? 'AI가 추천한 식당이에요. 확인하고 저장해주세요'
              : '가고 싶은 평양냉면집을 기록해보세요'}
          </p>
        </div>

        <div className="bg-wood-surface border-t-4 border-wood-wood rounded-sm shadow-md p-8">
          <RestaurantForm
            initialData={
              draft
                ? {
                    name: draft.name,
                    district: draft.district,
                    address: draft.address || '',
                    price: draft.price || 0,
                    solo_status: draft.solo_status,
                    map_url: '',
                    photo_url: draft.photo_url,
                  }
                : undefined
            }
          />
        </div>
      </main>
    </div>
  )
}
