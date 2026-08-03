'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SEOUL_DISTRICTS } from '@/lib/districts'
import { authFetch } from '@/lib/authFetch'

const SOLO_STATUS_OPTIONS = [
  '미확인',
  '혼자 이용 가능',
  '시간대에 따라 가능',
  '혼자 이용 어려움',
]

interface RestaurantFormProps {
  initialData?: {
    id?: number
    name: string
    district: string
    address: string
    price: number
    solo_status: string
    map_url: string
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900 rounded-lg border border-red-400 dark:border-red-700">
          <p className="text-red-800 dark:text-red-100 text-sm">{error}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-black dark:text-white mb-2">
          식당명 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="예: 서울 맛집"
          required
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-black dark:text-white mb-2">
          자치구 <span className="text-red-500">*</span>
        </label>
        <select
          name="district"
          value={formData.district}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <label className="block text-sm font-medium text-black dark:text-white mb-2">
          주소
        </label>
        <textarea
          name="address"
          value={formData.address}
          onChange={handleChange}
          placeholder="예: 서울시 강남구 테헤란로 123"
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-black dark:text-white mb-2">
          평균 가격 (원)
        </label>
        <input
          type="number"
          name="price"
          value={formData.price}
          onChange={handleChange}
          placeholder="0"
          min="0"
          step="1000"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-black dark:text-white mb-2">
          혼밥 가능 여부
        </label>
        <select
          name="solo_status"
          value={formData.solo_status}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SOLO_STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-black dark:text-white mb-2">
          네이버 지도 링크
        </label>
        <input
          type="text"
          name="map_url"
          value={formData.map_url}
          onChange={handleChange}
          placeholder="예: https://map.naver.com/..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
        >
          {loading ? '저장 중...' : '저장'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-black dark:text-white font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        >
          취소
        </button>
      </div>
    </form>
  )
}
