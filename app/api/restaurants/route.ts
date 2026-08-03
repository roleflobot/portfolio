import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

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
