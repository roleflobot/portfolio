import { getRequestUser } from '@/lib/supabase-server'
import { NextResponse, NextRequest } from 'next/server'

const GEMINI_MODEL = 'gemini-3.6-flash'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const { data: restaurant, error: fetchError } = await supabase
    .from('restaurants')
    .select('name, district, address, price, solo_status, rating, memo')
    .eq('id', id)
    .single()

  if (fetchError || !restaurant) {
    return NextResponse.json({ error: '식당을 찾을 수 없습니다.' }, { status: 404 })
  }

  const addressLine = restaurant.address
    ? `주소: ${restaurant.address}`
    : `주소: 상세주소 미등록 (자치구: ${restaurant.district ?? '정보 없음'})`

  const prompt = `너는 "평양냉면 혼밥 도장깨기"라는 개인 냉면 탐방 일지의 목소리다. 구글 검색으로 아래 식당에 대한 실제 방문자 리뷰를 여러 개 찾아, 그 리뷰들을 종합한 리뷰 요약을 한국어로 약 3문장 써라.

⚠️ 특정 리뷰 한두 개에 치우치지 마라. 유난히 극단적으로 좋거나 나쁜 리뷰보다, 여러 리뷰에서 반복적으로 나오는 평균적인 평가·경향을 반영해라.

⚠️ 가장 중요한 규칙: 같은 상호명을 쓰는 다른 지점(다른 주소)이 있을 수 있다. 검색 결과가 아래 "식당명"과 "주소"에 동시에 일치하는 지점의 리뷰인지 반드시 확인하고, 상호만 같고 주소가 다른 지점의 리뷰는 절대 섞지 마라. 주소가 일치하는 리뷰를 충분히 찾지 못했다면 검색 결과를 억지로 쓰지 말고, 아래 참고 정보(혼밥가능여부·메모)만으로 담백하게 짧게 요약해라.

⚠️ 가격 관련 규칙: 아래 "평양냉면 가격"은 우리 앱에 등록된 값일 뿐 지금 검색으로 재확인한 값이 아니며, 시간이 지나 실제 가격과 달라졌을 수 있다. 이 숫자를 검색으로 확인한 사실처럼 리뷰 요약에 인용하지 마라. 가격을 언급하고 싶다면 오직 검색된 리뷰에 실제로 적힌 가격·가격대 표현이 있을 때만 그 표현을 써라. 검색 리뷰에 가격 언급이 없다면 가격에 대한 말은 아예 하지 마라.

식당명: ${restaurant.name}
${addressLine}
자치구: ${restaurant.district ?? '정보 없음'}
평양냉면 가격(참고용, 검색 미확인): ${restaurant.price ? `${restaurant.price.toLocaleString()}원` : '정보 없음'}
혼밥 가능 여부: ${restaurant.solo_status ?? '미확인'}
개인 별점: ${restaurant.rating ? `${restaurant.rating}점 (5점 만점)` : '없음'}
메모: ${restaurant.memo || '없음'}

출력 형식 규칙(반드시 지켜라):
- 한국어로 약 3문장, 줄바꿈 없이 하나의 문단으로 이어서 쓴다. 문장 수를 세거나 후보를 나열하지 말고 곧바로 완성된 문단 하나만 낸다.
- 조용하고 담백한 문체, 감탄사·이모지·과장된 표현 금지. 서재의 장서에 남기는 차분한 열람 후기 같은 느낌.
- 앞뒤에 따옴표, 출처, 설명, "후보:" 같은 부연은 절대 붙이지 않는다.`

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.6,
          },
        }),
      }
    )

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.text()
      console.error('Gemini API error:', geminiResponse.status, errBody)
      return NextResponse.json(
        { error: 'AI 리뷰요약 생성에 실패했습니다.' },
        { status: 502 }
      )
    }

    const result = await geminiResponse.json()
    const rawText = (result?.candidates?.[0]?.content?.parts ?? [])
      .map((part: { text?: string }) => part.text ?? '')
      .join('')
      .trim()
    // 검색+추론 과정에서 후보 나열이나 글자수 계산 같은 잡음이 새어나오면
    // 리뷰 요약이 아니라 훨씬 길고 줄바꿈 섞인 장문이 되므로, 그런 결과는 저장하지 않는다.
    const text = rawText.replace(/\s*\n+\s*/g, ' ').trim()

    if (!text || text.length > 300 || /후보|글자 수/.test(text)) {
      console.error('Gemini unexpected output:', rawText.slice(0, 300))
      return NextResponse.json(
        { error: 'AI 리뷰요약 생성에 실패했습니다. 다시 시도해주세요.' },
        { status: 502 }
      )
    }

    const { data, error } = await supabase
      .from('restaurants')
      .update({ ai_comment: text })
      .eq('id', id)
      .select('ai_comment')
      .single()

    if (error || !data) {
      console.error('Supabase update error:', error?.message)
      return NextResponse.json(
        { error: 'AI 리뷰요약 저장에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ai_comment: data.ai_comment })
  } catch (error) {
    console.error('Gemini fetch error:', error)
    return NextResponse.json(
      { error: 'AI 리뷰요약 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
