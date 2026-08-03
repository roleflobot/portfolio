'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'

interface RestaurantPhotoProps {
  id: number
  photoUrl: string | null
  onChange: (photoUrl: string | null) => void
  compact?: boolean
}

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function RestaurantPhoto({
  id,
  photoUrl,
  onChange,
  compact = false,
}: RestaurantPhotoProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('jpg, png, webp 형식만 업로드할 수 있습니다.')
      return
    }
    if (file.size > MAX_SIZE) {
      setError('5MB 이하 파일만 업로드할 수 있습니다.')
      return
    }

    setError(null)
    setUploading(true)

    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error('로그인이 필요합니다.')

      const ext = file.name.split('.').pop()
      const path = `${userId}/${id}-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('restaurant-photos')
        .upload(path, file, { contentType: file.type })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('restaurant-photos')
        .getPublicUrl(path)

      const newPhotoUrl = publicUrlData.publicUrl

      const response = await authFetch(`/api/restaurants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_url: newPhotoUrl }),
      })

      if (!response.ok) {
        throw new Error('사진 정보를 저장하지 못했습니다.')
      }

      onChange(newPhotoUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : '사진 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const imageSizeClass = compact ? 'w-full aspect-square' : 'w-full h-64'

  return (
    <div>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt="식당 사진"
          className={`${imageSizeClass} object-cover rounded-sm border border-wood-border-strong`}
        />
      ) : (
        <div
          className={`${imageSizeClass} rounded-sm border-2 border-dashed border-wood-border-strong bg-wood-bg flex items-center justify-center`}
          style={{
            backgroundImage:
              'repeating-linear-gradient(100deg, rgba(139,107,74,0.08) 0 2px, transparent 2px 12px)',
          }}
        >
          <span className="text-xs text-wood-muted text-center px-1">사진 없음</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={`mt-2 w-full border border-wood-border-strong text-wood-ink font-medium rounded-sm hover:bg-wood-bg transition-colors disabled:opacity-50 ${
          compact ? 'px-2 py-1 text-xs' : 'px-4 py-2 text-sm'
        }`}
      >
        {uploading ? '업로드 중...' : photoUrl ? '사진 변경' : '사진 업로드'}
      </button>
      {error && <p className="mt-2 text-xs text-wood-danger">{error}</p>}
    </div>
  )
}
