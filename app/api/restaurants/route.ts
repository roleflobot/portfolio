import { supabase } from '@/lib/supabase'
import { NextResponse, NextRequest } from 'next/server'

export async function GET() {
  try {
    console.log('🔍 Fetching restaurants from Supabase...')
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .order('id', { ascending: true })

    console.log('📊 Data:', data)
    console.log('❌ Error:', error)

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
    console.log('📝 Creating new restaurant...')
    const body = await request.json()

    // 입력값 검증
    const { name, district, address, price, solo_status } = body

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
    if (price !== undefined && price !== null) {
      const priceNum = Number(price)
      if (isNaN(priceNum) || priceNum < 0) {
        return NextResponse.json(
          { error: '가격은 0 이상이어야 합니다.' },
          { status: 400 }
        )
      }
    }

    // Supabase에 저장
    const { data, error } = await supabase
      .from('restaurants')
      .insert([
        {
          name: name.trim(),
          district: district.trim(),
          address: address?.trim() || null,
          price: price || 0,
          solo_status: solo_status || false,
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
