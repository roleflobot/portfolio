export const SOLO_STATUS_VALUES = [
  '1인석 있음 (네이버 지도 정보)',
  '1인석 있음 (직접 확인)',
  '1인석 있음 (AI 검색 확인)',
  '미확인',
] as const

export type SoloStatus = (typeof SOLO_STATUS_VALUES)[number]
