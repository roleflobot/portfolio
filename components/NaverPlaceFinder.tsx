'use client'

import { useState } from 'react'
import { authFetch } from '@/lib/authFetch'

export interface NaverPlaceFields {
  map_url: string
  naver_place_name: string
  naver_category: string
  naver_address: string
  naver_road_address: string
  naver_mapx: number | null
  naver_mapy: number | null
  naver_map_url: string
  naver_link_source: '' | 'auto' | 'manual'
  naver_matched_at: string | null
}

interface Candidate {
  name: string
  category: string
  address: string
  roadAddress: string
  lat: number
  lng: number
  mapUrl: string
  nmapUrl: string
}

interface NaverPlaceFinderProps {
  name: string
  address: string
  district: string
  value: NaverPlaceFields
  onChange: (fields: NaverPlaceFields) => void
}

type Mode = 'idle' | 'results' | 'manual'

export default function NaverPlaceFinder({
  name,
  address,
  district,
  value,
  onChange,
}: NaverPlaceFinderProps) {
  const [mode, setMode] = useState<Mode>('idle')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualDraft, setManualDraft] = useState('')

  const handleSearch = async () => {
    if (!name.trim()) {
      setError('식당명을 먼저 입력해주세요.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await authFetch('/api/naver-place-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address, district }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '검색에 실패했습니다.')
      }

      const data = await response.json()
      if (!data.candidates || data.candidates.length === 0) {
        setError('서울 지역에서 일치하는 장소를 찾지 못했습니다. 직접 링크를 입력해주세요.')
        setCandidates([])
        setMode('manual')
        return
      }

      setCandidates(data.candidates)
      setIndex(0)
      setMode('results')
    } catch (err) {
      setError(err instanceof Error ? err.message : '검색에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmCandidate = (candidate: Candidate) => {
    onChange({
      map_url: candidate.mapUrl,
      naver_place_name: candidate.name,
      naver_category: candidate.category,
      naver_address: candidate.address,
      naver_road_address: candidate.roadAddress,
      naver_mapx: candidate.lng,
      naver_mapy: candidate.lat,
      naver_map_url: candidate.nmapUrl,
      naver_link_source: 'auto',
      naver_matched_at: new Date().toISOString(),
    })
    setMode('idle')
  }

  const handleNextCandidate = () => {
    setIndex((prev) => (prev + 1) % candidates.length)
  }

  const handleApplyManual = () => {
    if (!manualDraft.trim()) return
    try {
      new URL(manualDraft.trim())
    } catch {
      setError('올바른 링크 형식이 아닙니다.')
      return
    }

    onChange({
      map_url: manualDraft.trim(),
      naver_place_name: '',
      naver_category: '',
      naver_address: '',
      naver_road_address: '',
      naver_mapx: null,
      naver_mapy: null,
      naver_map_url: '',
      naver_link_source: 'manual',
      naver_matched_at: null,
    })
    setError(null)
    setManualDraft('')
    setMode('idle')
  }

  const current = candidates[index]

  const confirmedLabel =
    value.naver_link_source === 'auto' && value.naver_place_name
      ? `${value.naver_place_name} (${value.naver_road_address})`
      : value.map_url

  return (
    <div>
      {value.map_url && mode === 'idle' && (
        <div className="mb-3 px-3 py-2 border border-wood-border-strong rounded-sm bg-wood-bg text-sm text-wood-ink">
          ✅ 네이버 지도 연결됨: {confirmedLabel}
        </div>
      )}

      {mode === 'idle' && (
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="w-full px-4 py-2 border border-wood-border-strong text-wood-ink font-medium rounded-sm hover:bg-wood-bg transition-colors disabled:opacity-50"
        >
          {loading ? '검색 중...' : value.map_url ? '다시 찾기' : '네이버 장소 찾기'}
        </button>
      )}

      {mode === 'results' && current && (
        <div className="border border-wood-border-strong rounded-sm p-4 bg-wood-bg space-y-3">
          <p className="text-sm text-wood-ink font-medium">네이버 장소를 찾았습니다.</p>
          <div>
            <p className="font-semibold text-wood-ink">{current.name}</p>
            <p className="text-sm text-wood-muted">{current.roadAddress || current.address}</p>
            <p className="text-sm text-wood-muted">{current.category}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleConfirmCandidate(current)}
              className="flex-1 px-3 py-2 bg-wood-accent hover:bg-wood-accent-hover text-wood-accent-ink text-sm font-medium rounded-sm transition-colors"
            >
              이 장소로 연결
            </button>
            {candidates.length > 1 && (
              <button
                type="button"
                onClick={handleNextCandidate}
                className="flex-1 px-3 py-2 border border-wood-border-strong text-wood-ink text-sm font-medium rounded-sm hover:bg-wood-surface transition-colors"
              >
                다른 결과 보기 ({index + 1}/{candidates.length})
              </button>
            )}
          </div>
          <div className="pt-2 border-t border-wood-border text-sm text-wood-muted">
            찾은 장소가 정확하지 않나요? 네이버 지도에서 장소를 직접 검색한 뒤 공유 링크를 붙여넣으세요.
            <button
              type="button"
              onClick={() => setMode('manual')}
              className="ml-2 text-wood-accent underline"
            >
              직접 링크 입력
            </button>
          </div>
        </div>
      )}

      {mode === 'manual' && (
        <div className="border border-wood-border-strong rounded-sm p-4 bg-wood-bg space-y-2">
          <p className="text-sm text-wood-ink">
            네이버 지도에서 상호를 검색하여 &quot;공유&quot; 링크를 입력하세요.
            <br />
            (예: https://naver.me/xxY2cYXP)
          </p>
          <input
            type="text"
            value={manualDraft}
            onChange={(e) => setManualDraft(e.target.value)}
            placeholder="https://naver.me/..."
            className="w-full px-4 py-2 border border-wood-border-strong rounded-sm bg-wood-surface text-wood-ink placeholder-wood-muted focus:outline-none focus:ring-2 focus:ring-wood-accent"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApplyManual}
              className="flex-1 px-3 py-2 bg-wood-accent hover:bg-wood-accent-hover text-wood-accent-ink text-sm font-medium rounded-sm transition-colors"
            >
              적용
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('idle')
                setManualDraft('')
                setError(null)
              }}
              className="flex-1 px-3 py-2 border border-wood-border-strong text-wood-ink text-sm font-medium rounded-sm hover:bg-wood-surface transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-wood-danger">{error}</p>}
    </div>
  )
}
