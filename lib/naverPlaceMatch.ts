const APP_URL = 'https://quest-theta-cyan.vercel.app'

export interface RawNaverItem {
  title: string
  category: string
  address: string
  roadAddress: string
  mapx: string
  mapy: string
}

export interface MatchCandidate {
  name: string
  category: string
  address: string
  roadAddress: string
  lat: number
  lng: number
  nameMatch: boolean
  addressMatch: boolean
  score: number
  mapUrl: string
  nmapUrl: string
}

export function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '')
}

export function normalize(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase()
}

export function isSeoulAddress(item: Pick<RawNaverItem, 'address' | 'roadAddress'>): boolean {
  return (item.address || '').includes('서울특별시') || (item.roadAddress || '').includes('서울특별시')
}

export function buildWebSearchUrl(placeName: string): string {
  // 상호명만으로 검색하면 동명의 다른 업종 업체가 같이 뜨는 경우가 있어 '냉면'을 붙여 정확도를 높인다
  return `https://map.naver.com/p/search/${encodeURIComponent(`${placeName} 냉면`)}`
}

export function buildNmapUrl(lat: number, lng: number, placeName: string): string {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    name: placeName,
    appname: APP_URL,
  })
  return `nmap://place?${params.toString()}`
}

export async function searchNaverLocal(query: string): Promise<RawNaverItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('NAVER_CLIENT_ID/SECRET이 설정되지 않았습니다.')
  }

  const url =
    'https://naverapihub.apigw.ntruss.com/search/v1/local?' +
    new URLSearchParams({ query, display: '5' })

  const res = await fetch(url, {
    headers: {
      'X-NCP-APIGW-API-KEY-ID': clientId,
      'X-NCP-APIGW-API-KEY': clientSecret,
    },
  })

  if (!res.ok) {
    throw new Error(`네이버 지역 검색 API 오류: ${res.status}`)
  }

  const json = await res.json()
  return json.items || []
}

/**
 * 상호명 + 주소로 검색하고, 서울 주소만 남긴 뒤 일치도로 정렬한 후보 목록을 반환한다.
 * 첫 번째 결과를 무조건 확정하지 않는다 — 호출부에서 사용자가 확인하거나
 * 마이그레이션 스크립트에서 임계값을 넘는지 판단해야 한다.
 */
export async function findSeoulCandidates(
  inputName: string,
  inputAddress: string,
  inputDistrict: string
): Promise<MatchCandidate[]> {
  const query = `${inputName} ${inputAddress || inputDistrict}`.trim()
  const items = await searchNaverLocal(query)
  const seoulItems = items.filter(isSeoulAddress)

  const candidates: MatchCandidate[] = seoulItems.map((item) => {
    const cleanName = stripHtml(item.title)
    const normCandidateName = normalize(cleanName)
    const normInputName = normalize(inputName)
    const nameMatch =
      normInputName.length > 0 &&
      (normCandidateName.includes(normInputName) || normInputName.includes(normCandidateName))

    const addressText = item.roadAddress || item.address
    const addressMatch =
      inputDistrict.trim().length > 0 && addressText.includes(inputDistrict.trim())

    const lat = Number(item.mapy) / 1e7
    const lng = Number(item.mapx) / 1e7

    return {
      name: cleanName,
      category: item.category,
      address: item.address,
      roadAddress: item.roadAddress,
      lat,
      lng,
      nameMatch,
      addressMatch,
      score: (nameMatch ? 2 : 0) + (addressMatch ? 1 : 0),
      mapUrl: buildWebSearchUrl(cleanName),
      nmapUrl: buildNmapUrl(lat, lng, cleanName),
    }
  })

  candidates.sort((a, b) => b.score - a.score)
  return candidates
}
