export const SOLO_STATUS_VALUES = ['네이버 지도 정보', '직접 확인', '미확인'] as const

export type SoloStatus = (typeof SOLO_STATUS_VALUES)[number]
