import { getRequestUser } from '@/lib/supabase-server'
import { SOLO_STATUS_VALUES } from '@/lib/soloStatus'
import { NextResponse, NextRequest } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { user, supabase } = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

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
    const { user, supabase } = await getRequestUser(request)
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

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
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '식당을 찾을 수 없습니다.' }, { status: 404 })
      }
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const { user, supabase } = await getRequestUser(request)
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { visited, rating, memo } = body

    const update: Record<string, unknown> = {}

    if (visited !== undefined) {
      if (typeof visited !== 'boolean') {
        return NextResponse.json(
          { error: '방문 여부 값이 올바르지 않습니다.' },
          { status: 400 }
        )
      }
      update.visited = visited
      if (!visited) {
        // 방문하지 않은 식당은 별점을 저장하지 않는다
        update.rating = null
      }
    }

    if (rating !== undefined) {
      if (rating !== null) {
        const ratingNum = Number(rating)
        if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
          return NextResponse.json(
            { error: '별점은 1~5 사이의 정수여야 합니다.' },
            { status: 400 }
          )
        }
        update.rating = ratingNum
        if (visited === undefined) {
          // 별점을 매겼다는 것은 방문했다는 뜻이므로 자동으로 방문완료 처리한다
          update.visited = true
        }
      } else {
        update.rating = null
      }
    }

    if (memo !== undefined) {
      update.memo = typeof memo === 'string' ? memo.trim() || null : null
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: '수정할 항목이 없습니다.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('restaurants')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error?.code === 'PGRST116') {
      return NextResponse.json({ error: '식당을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (error || !data) {
      console.error('Supabase error:', error?.message)
      return NextResponse.json(
        { error: '식당 정보 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Catch error:', error)
    return NextResponse.json(
      { error: '식당 정보 업데이트에 실패했습니다.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { user, supabase } = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { data, error } = await supabase.from('restaurants').delete().eq('id', id).select()

  if (error) {
    console.error('Supabase error:', error.message)
    return NextResponse.json(
      { error: '식당 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: '식당을 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
