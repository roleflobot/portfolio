import { getRequestUser } from '@/lib/supabase-server'
import { SOLO_STATUS_VALUES } from '@/lib/soloStatus'
import { NextResponse, NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getRequestUser(request)
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const visited = searchParams.get('visited')
    const district = searchParams.get('district')
    const search = searchParams.get('search')

    let query = supabase.from('restaurants').select('*').order('id', { ascending: true })

    if (visited === 'true' || visited === 'false') {
      query = query.eq('visited', visited === 'true')
    }

    if (district) {
      query = query.eq('district', district)
    }

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Supabase error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Catch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch restaurants' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getRequestUser(request)
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()

    // 입력값 검증
    const { name, district, address, price, solo_status, map_url } = body

    // 필수 필드 검증
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

    // 가격 검증
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

    // 지도 링크: 직접 입력한 링크 > 주소 기반 검색 > 식당명+냉면 검색 순으로 사용한다
    const trimmedAddress = address?.trim()
    const resolvedMapUrl =
      map_url?.trim() ||
      `https://map.naver.com/p/search/${encodeURIComponent(
        trimmedAddress || `${name.trim()} 냉면`
      )}`

    // Supabase에 저장
    const { data, error } = await supabase
      .from('restaurants')
      .insert([
        {
          name: name.trim(),
          food: '평양냉면',
          district: district.trim(),
          address: trimmedAddress || null,
          price: price || null,
          solo_status: solo_status || '미확인',
          map_url: resolvedMapUrl,
          user_id: user.id,
        },
      ])
      .select()

    if (error) {
      console.error('Supabase error:', error.message)
      return NextResponse.json(
        { error: '식당 등록에 실패했습니다.' },
        { status: 500 }
      )
    }

    console.log('✅ Restaurant created:', data)
    return NextResponse.json(data?.[0], { status: 201 })
  } catch (error) {
    console.error('Catch error:', error)
    return NextResponse.json(
      { error: '식당 등록에 실패했습니다.' },
      { status: 500 }
    )
  }
}
