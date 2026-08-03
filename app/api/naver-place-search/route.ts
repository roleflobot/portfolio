import { getRequestUser } from '@/lib/supabase-server'
import { NextResponse, NextRequest } from 'next/server'

interface NaverLocalSearchItem {
  title: string
  category: string
  address: string
  roadAddress: string
  mapx: string
  mapy: string
}

export interface PlaceCandidate {
  name: string
  category: string
  address: string
  roadAddress: string
  lat: number
  lng: number
  mapUrl: string
  score: number
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '')
}

function normalize(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase()
}

function scoreCandidate(
  candidateName: string,
  candidateAddress: string,
  inputName: string,
  inputDistrict: string
): number {
  const normCandidateName = normalize(candidateName)
  const normInputName = normalize(inputName)
  const nameMatch =
    normInputName.length > 0 &&
    (normCandidateName.includes(normInputName) || normInputName.includes(normCandidateName))

  const addressMatch =
    inputDistrict.trim().length > 0 && candidateAddress.includes(inputDistrict.trim())

  return (nameMatch ? 2 : 0) + (addressMatch ? 1 : 0)
}

export async function POST(request: NextRequest) {
  const { user } = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: '네이버 API가 설정되지 않았습니다.' }, { status: 500 })
  }

  const body = await request.json()
  const { name, address, district } = body as {
    name?: string
    address?: string
    district?: string
  }

  if (!name || !name.trim()) {
    return NextResponse.json({ error: '식당명을 먼저 입력해주세요.' }, { status: 400 })
  }

  const locationHint = (address || district || '').trim()
  const query = `${name.trim()} 평양냉면 ${locationHint}`.trim()

  try {
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
      return NextResponse.json({ error: '네이버 장소 검색에 실패했습니다.' }, { status: 502 })
    }

    const json = await res.json()
    const items: NaverLocalSearchItem[] = json.items || []

    const candidates: PlaceCandidate[] = items.map((item) => {
      const cleanName = stripHtml(item.title)
      return {
        name: cleanName,
        category: item.category,
        address: item.address,
        roadAddress: item.roadAddress,
        lat: Number(item.mapy) / 1e7,
        lng: Number(item.mapx) / 1e7,
        mapUrl: `https://map.naver.com/p/search/${encodeURIComponent(cleanName)}`,
        score: scoreCandidate(cleanName, item.roadAddress || item.address, name, district || ''),
      }
    })

    candidates.sort((a, b) => b.score - a.score)

    return NextResponse.json({ candidates })
  } catch (error) {
    console.error('Naver place search error:', error)
    return NextResponse.json({ error: '네이버 장소 검색 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
