export const AI_RECOMMEND_DRAFT_KEY = 'ai_recommend_draft'

export interface AiRecommendDraft {
  name: string
  district: string
  address: string | null
  price: number | null
  solo_status: string
  photo_url: string | null
}
