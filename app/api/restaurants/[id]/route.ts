import { supabase } from '@/lib/supabase'
import { NextResponse, NextRequest } from 'next/server'

const SOLO_STATUS_VALUES = [
  '미확인',
  '혼자 이용 가능',
  '시간대에 따라 가능',
  '혼자 이용 어려움',
]

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: '식당을 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()
    const { name, district, address, price, solo_status, map_url } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: '식당명은 필수 입력 사항입니다.' },
        { status: 400 }
      )
    }

    if (!district || typeof district !== 'string' || !district.trim()) {
      return NextResponse.json(
        { error: '자치구는 필수 입력 사항입니다.' },
        { status: 400 }
      )
    }

    if (price !== undefined && price !== null && price !== '') {
      const priceNum = Number(price)
      if (isNaN(priceNum) || priceNum < 0) {
        return NextResponse.json(
          { error: '가격은 0 이상이어야 합니다.' },
          { status: 400 }
        )
      }
    }

    if (solo_status && !SOLO_STATUS_VALUES.includes(solo_status)) {
      return NextResponse.json(
        { error: '혼밥 가능 여부 값이 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    if (map_url && typeof map_url === 'string' && map_url.trim()) {
      try {
        new URL(map_url.trim())
      } catch {
        return NextResponse.json(
          { error: '네이버 지도 링크 형식이 올바르지 않습니다.' },
          { status: 400 }
        )
      }
    }

    const { data, error } = await supabase
      .from('restaurants')
      .update({
        name: name.trim(),
        district: district.trim(),
        address: address?.trim() || null,
        price: price || null,
        solo_status: solo_status || '미확인',
        map_url: map_url?.trim() || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error.message)
      return NextResponse.json(
        { error: '식당 수정에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Catch error:', error)
    return NextResponse.json(
      { error: '식당 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { error } = await supabase.from('restaurants').delete().eq('id', id)

  if (error) {
    console.error('Supabase error:', error.message)
    return NextResponse.json(
      { error: '식당 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
