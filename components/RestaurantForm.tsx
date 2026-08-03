'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SEOUL_DISTRICTS } from '@/lib/districts'
import { authFetch } from '@/lib/authFetch'
import { SOLO_STATUS_VALUES } from '@/lib/soloStatus'
import NaverPlaceFinder, { type NaverPlaceFields } from '@/components/NaverPlaceFinder'

interface RestaurantFormProps {
  initialData?: {
    id?: number
    name: string
    district: string
    address: string
    price: number
    solo_status: string
    map_url: string
    naver_place_name?: string
    naver_category?: string
    naver_road_address?: string
    naver_mapx?: number | null
    naver_mapy?: number | null
    naver_link_source?: string
  }
  isEditing?: boolean
}

export default function RestaurantForm({
  initialData,
  isEditing = false,
}: RestaurantFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    district: initialData?.district || '',
    address: initialData?.address || '',
    price: initialData?.price || 0,
    solo_status: initialData?.solo_status || '미확인',
    map_url: initialData?.map_url || '',
    naver_place_name: initialData?.naver_place_name || '',
    naver_category: initialData?.naver_category || '',
    naver_road_address: initialData?.naver_road_address || '',
    naver_mapx: initialData?.naver_mapx ?? null,
    naver_mapy: initialData?.naver_mapy ?? null,
    naver_link_source: (initialData?.naver_link_source || '') as NaverPlaceFields['naver_link_source'],
  })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }))
  }

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('식당명은 필수 입력 사항입니다.')
      return false
    }
    if (!formData.district.trim()) {
      setError('자치구는 필수 입력 사항입니다.')
      return false
    }
    if (formData.price < 0) {
      setError('가격은 0 이상이어야 합니다.')
      return false
    }
    setError(null)
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const url =
        isEditing && initialData?.id
          ? `/api/restaurants/${initialData.id}`
          : '/api/restaurants'
      const method = isEditing ? 'PUT' : 'POST'

      const response = await authFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '저장에 실패했습니다.')
      }

      const saved = await response.json()
      router.push(isEditing ? `/restaurants/${saved.id}` : '/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    router.push(isEditing && initialData?.id ? `/restaurants/${initialData.id}` : '/')
  }

  const inputClass =
    'w-full px-4 py-2 border border-wood-border-strong rounded-sm bg-wood-surface text-wood-ink placeholder-wood-muted focus:outline-none focus:ring-2 focus:ring-wood-accent'
  const labelClass = 'block text-sm font-medium text-wood-ink mb-2'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-wood-error-bg rounded-sm border border-wood-error-border">
          <p className="text-wood-error-ink text-sm">{error}</p>
        </div>
      )}

      <div>
        <label className={labelClass}>
          식당명 <span className="text-wood-danger">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="예: 서울 맛집"
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>
          자치구 <span className="text-wood-danger">*</span>
        </label>
        <select
          name="district"
          value={formData.district}
          onChange={handleChange}
          required
          className={inputClass}
        >
          <option value="">자치구를 선택하세요</option>
          {SEOUL_DISTRICTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>
          주소
        </label>
        <textarea
          name="address"
          value={formData.address}
          onChange={handleChange}
          placeholder="예: 서울시 강남구 테헤란로 123"
          rows={3}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>
          평양냉면 가격 (원)
        </label>
        <input
          type="number"
          name="price"
          value={formData.price}
          onChange={handleChange}
          placeholder="0"
          min="0"
          step="1000"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>
          혼밥 가능 여부
        </label>
        <select
          name="solo_status"
          value={formData.solo_status}
          onChange={handleChange}
          className={inputClass}
        >
          {SOLO_STATUS_VALUES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>
          네이버 지도 링크
        </label>
        <NaverPlaceFinder
          name={formData.name}
          address={formData.address}
          district={formData.district}
          value={{
            map_url: formData.map_url,
            naver_place_name: formData.naver_place_name,
            naver_category: formData.naver_category,
            naver_road_address: formData.naver_road_address,
            naver_mapx: formData.naver_mapx,
            naver_mapy: formData.naver_mapy,
            naver_link_source: formData.naver_link_source,
          }}
          onChange={(fields) => setFormData((prev) => ({ ...prev, ...fields }))}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-6 py-3 bg-wood-accent hover:bg-wood-accent-hover disabled:bg-wood-accent/50 text-wood-accent-ink font-medium rounded-sm transition-colors"
        >
          {loading ? '저장 중...' : '저장'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="flex-1 px-6 py-3 border border-wood-border-strong text-wood-ink font-medium rounded-sm hover:bg-wood-bg transition-colors"
        >
          취소
        </button>
      </div>
    </form>
  )
}
