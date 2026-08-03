import { getRequestUser } from '@/lib/supabase-server'
import { findSeoulCandidates } from '@/lib/naverPlaceMatch'
import { NextResponse, NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { user } = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
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

  try {
    const candidates = await findSeoulCandidates(name, address || '', district || '')
    return NextResponse.json({ candidates })
  } catch (error) {
    console.error('Naver place search error:', error)
    return NextResponse.json({ error: '네이버 장소 검색 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
