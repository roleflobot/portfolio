'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface RestaurantFormProps {
  initialData?: {
    id?: number
    name: string
    district: string
    address: string
    price: number
    solo_status: boolean
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
    solo_status: initialData?.solo_status || false,
  })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : type === 'number'
            ? parseFloat(value) || 0
            : value,
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
      const response = await fetch('/api/restaurants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '저장에 실패했습니다.')
      }

      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    router.push('/')
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
          <option value="강남구">강남구</option>
          <option value="강북구">강북구</option>
          <option value="강동구">강동구</option>
          <option value="강서구">강서구</option>
          <option value="관악구">관악구</option>
          <option value="광진구">광진구</option>
          <option value="구로구">구로구</option>
          <option value="금천구">금천구</option>
          <option value="노원구">노원구</option>
          <option value="도봉구">도봉구</option>
          <option value="동대문구">동대문구</option>
          <option value="동작구">동작구</option>
          <option value="마포구">마포구</option>
          <option value="서대문구">서대문구</option>
          <option value="서초구">서초구</option>
          <option value="성동구">성동구</option>
          <option value="성북구">성북구</option>
          <option value="송파구">송파구</option>
          <option value="양천구">양천구</option>
          <option value="영등포구">영등포구</option>
          <option value="용산구">용산구</option>
          <option value="은평구">은평구</option>
          <option value="종로구">종로구</option>
          <option value="중구">중구</option>
          <option value="중랑구">중랑구</option>
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

      <div className="flex items-center">
        <input
          type="checkbox"
          name="solo_status"
          id="solo_status"
          checked={formData.solo_status}
          onChange={handleChange}
          className="w-4 h-4 border border-gray-300 rounded bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
        />
        <label htmlFor="solo_status" className="ml-3 text-sm font-medium text-black dark:text-white cursor-pointer">
          혼밥 가능
        </label>
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
