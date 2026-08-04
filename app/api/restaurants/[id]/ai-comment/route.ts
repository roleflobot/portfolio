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
    .select('name, district, price, solo_status, rating, memo, visited')
    .eq('id', id)
    .single()

  if (fetchError || !restaurant) {
    return NextResponse.json({ error: '식당을 찾을 수 없습니다.' }, { status: 404 })
  }

  if (!restaurant.visited) {
    return NextResponse.json(
      { error: '방문 완료한 식당만 AI 한줄평을 만들 수 있습니다.' },
      { status: 400 }
    )
  }

  const prompt = `너는 "평양냉면 혼밥 도장깨기"라는 개인 냉면 탐방 일지의 목소리다. 아래 정보를 바탕으로 이 식당에 대한 한 줄 평을 한국어 문장 하나(20~40자)로 써라. 조용하고 담백한 문체를 쓰고, 감탄사나 이모지, 과장된 표현은 쓰지 마라. 실제 서재의 장서에 남기는 짧은 열람 후기 같은 느낌으로 써라.

식당명: ${restaurant.name}
자치구: ${restaurant.district ?? '정보 없음'}
평양냉면 가격: ${restaurant.price ? `${restaurant.price.toLocaleString()}원` : '정보 없음'}
혼밥 가능 여부: ${restaurant.solo_status ?? '미확인'}
개인 별점: ${restaurant.rating ? `${restaurant.rating}점 (5점 만점)` : '없음'}
메모: ${restaurant.memo || '없음'}

한 줄 평 문장만 출력하고, 다른 설명이나 따옴표는 붙이지 마라.`

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.8,
          },
        }),
      }
    )

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.text()
      console.error('Gemini API error:', geminiResponse.status, errBody)
      return NextResponse.json(
        { error: 'AI 한줄평 생성에 실패했습니다.' },
        { status: 502 }
      )
    }

    const result = await geminiResponse.json()
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

    if (!text) {
      return NextResponse.json(
        { error: 'AI 한줄평 생성에 실패했습니다.' },
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
        { error: 'AI 한줄평 저장에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ai_comment: data.ai_comment })
  } catch (error) {
    console.error('Gemini fetch error:', error)
    return NextResponse.json(
      { error: 'AI 한줄평 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
