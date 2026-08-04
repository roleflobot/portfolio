import { getRequestUser } from '@/lib/supabase-server'
import { SEOUL_DISTRICTS } from '@/lib/districts'
import { NextResponse, NextRequest } from 'next/server'

const GEMINI_MODEL = 'gemini-3.6-flash'
const RESULT_MARKER = 'RESULT_JSON:'

interface RecommendResult {
  found: boolean
  name: string | null
  address: string | null
  price: number | null
  solo_friendly: boolean | null
  photo_url: string | null
}

function buildPrompt(district: string, excludeNames: string[]) {
  return `서울 ${district}에서 1인 식사(혼밥)가 가능한 평양냉면 맛집을 구글 검색으로 실제로 찾아봐라. 검색 없이 답하면 안 된다.

이미 등록되어 있어 추천에서 제외해야 할 식당: ${excludeNames.length ? excludeNames.join(', ') : '없음'}

먼저 검색으로 확인한 내용을 짧게 정리해서 설명해라. 그 다음 반드시 마지막 줄에 아래 형식의 JSON을 한 줄로 출력해라 (이 줄만 따로 파싱할 것이다):
${RESULT_MARKER} {"found": true 또는 false, "name": string 또는 null, "address": string 또는 null, "price": number 또는 null, "solo_friendly": true|false|null, "photo_url": string 또는 null}

규칙:
- found:true인 경우에만 name과 address를 채워라. 주소는 실제 도로명주소 전체로.
- 제외 목록에 있는 식당과 이름이나 주소가 겹치면 안 된다.
- price는 검색으로 실제 확인된 경우에만 원 단위 숫자로 채우고, 모르면 null.
- photo_url은 그 식당의 실제 평양냉면 사진이라고 확신되는 이미지의 직접 URL을 검색으로 찾았을 때만 채우고, 확신이 없거나 비슷한 다른 사진뿐이면 반드시 null. 절대 추측하거나 관련 없는 사진을 대신 넣지 마라.
- 혼밥 가능한 곳을 전혀 찾지 못했으면 마지막 줄에 ${RESULT_MARKER} {"found": false, "name": null, "address": null, "price": null, "solo_friendly": null, "photo_url": null} 만 출력해라.`
}

function extractResult(text: string): RecommendResult | null {
  const idx = text.lastIndexOf(RESULT_MARKER)
  if (idx === -1) return null
  const tail = text.slice(idx + RESULT_MARKER.length)
  const start = tail.indexOf('{')
  const end = tail.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null

  try {
    const parsed = JSON.parse(tail.slice(start, end + 1))
    if (typeof parsed.found !== 'boolean') return null
    return {
      found: parsed.found,
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : null,
      address:
        typeof parsed.address === 'string' && parsed.address.trim() ? parsed.address.trim() : null,
      price: typeof parsed.price === 'number' && parsed.price > 0 ? Math.round(parsed.price) : null,
      solo_friendly: typeof parsed.solo_friendly === 'boolean' ? parsed.solo_friendly : null,
      photo_url:
        typeof parsed.photo_url === 'string' && parsed.photo_url.trim()
          ? parsed.photo_url.trim()
          : null,
    }
  } catch {
    return null
  }
}

// AI가 내놓은 사진 URL이 실제로 열리는 이미지인지 확인한다.
// 확신을 못 하거나 죽은 링크면 사진 없이 두는 쪽이 사진을 잘못 붙이는 것보다 안전하다.
async function verifyImageUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false

    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(6000),
      headers: { Accept: 'image/*' },
    })
    if (!response.ok) return false
    const contentType = response.headers.get('content-type') || ''
    return contentType.startsWith('image/')
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const { user, supabase } = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Gemini API 키가 설정되지 않았습니다.' },
      { status: 500 }
    )
  }

  const body = await request.json()
  const { district } = body as { district?: string }

  if (!district || !SEOUL_DISTRICTS.includes(district as (typeof SEOUL_DISTRICTS)[number])) {
    return NextResponse.json({ error: '올바른 자치구를 선택해주세요.' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('restaurants')
    .select('name')
    .eq('district', district)

  const excludeNames = (existing ?? []).map((r) => r.name)

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(district, excludeNames) }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            maxOutputTokens: 3072,
            temperature: 0.4,
          },
        }),
      }
    )

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.text()
      console.error('Gemini API error:', geminiResponse.status, errBody)
      return NextResponse.json({ error: 'AI 추천에 실패했습니다.' }, { status: 502 })
    }

    const geminiResult = await geminiResponse.json()
    const rawText = (geminiResult?.candidates?.[0]?.content?.parts ?? [])
      .map((part: { text?: string }) => part.text ?? '')
      .join('')

    const result = extractResult(rawText)

    if (!result) {
      console.error('Gemini unexpected output for ai-recommend:', rawText.slice(0, 300))
      return NextResponse.json({ error: 'AI 추천에 실패했습니다. 다시 시도해주세요.' }, { status: 502 })
    }

    if (!result.found || !result.name || !result.address) {
      return NextResponse.json({ found: false })
    }

    let photoUrl: string | null = result.photo_url
    if (photoUrl && !(await verifyImageUrl(photoUrl))) {
      photoUrl = null
    }

    return NextResponse.json({
      found: true,
      name: result.name,
      district,
      address: result.address,
      price: result.price,
      solo_status: result.solo_friendly ? '1인석 있음 (AI 검색 확인)' : '미확인',
      photo_url: photoUrl,
    })
  } catch (error) {
    console.error('Gemini fetch error:', error)
    return NextResponse.json({ error: 'AI 추천 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
