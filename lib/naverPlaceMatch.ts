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

/**
 * 도로명주소가 있으면 주소로, 없으면 상호명+'냉면'으로 검색 링크를 만든다.
 * 상호명만으로 검색하면 이름이 겹치는 다른 지역·업종 업체가 같이 나오는 경우가 있어,
 * 주소(고유 지점)가 있을 때는 그쪽이 훨씬 정확하다.
 */
export function buildWebSearchUrl(addressOrName: string, isAddress = false): string {
  const query = isAddress ? addressOrName : `${addressOrName} 냉면`
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`
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
      mapUrl: item.roadAddress
        ? buildWebSearchUrl(item.roadAddress, true)
        : buildWebSearchUrl(cleanName, false),
      nmapUrl: buildNmapUrl(lat, lng, cleanName),
    }
  })

  candidates.sort((a, b) => b.score - a.score)
  return candidates
}
