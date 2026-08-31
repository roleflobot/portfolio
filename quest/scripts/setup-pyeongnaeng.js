const { createClient } = require('@supabase/supabase-js');
require('./load-env')();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ 환경변수가 설정되지 않았습니다.');
  console.error('   .env.local 파일을 확인하세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function setupPyeongnaeng() {
  try {
    console.log('🍜 평양냉면 혼밥 도장깨기 DB 설정 중...');

    // 기존 데이터 삭제 (선택사항)
    console.log('📋 기존 데이터 제거 중...');
    await supabase.from('restaurants').delete().gte('id', 0);

    // 초기 데이터 5개 추가 (테스트용 user_id)
    const testUserId = '550e8400-e29b-41d4-a716-446655440000';

    const initialData = [
      {
        name: '능라도 명동',
        district: '중구',
        address: '서울 중구 명동길 8',
        price: 17000,
        solo_status: '미확인',
        visited: false,
        rating: null,
        memo: null,
        map_url: 'https://map.naver.com/v5/search?query=능라도명동&c=37.5640,126.9831,15,0,0,0,dh',
        user_id: testUserId
      },
      {
        name: '경기옥',
        district: '강남구',
        address: '서울 강남구 테헤란로 323',
        price: 15000,
        solo_status: '미확인',
        visited: false,
        rating: null,
        memo: null,
        map_url: 'https://map.naver.com/v5/search?query=경기옥&c=37.4979,127.0276,15,0,0,0,dh',
        user_id: testUserId
      },
      {
        name: '대엽 을지로',
        district: '중구',
        address: '서울 중구 을지로 8-1',
        price: 13000,
        solo_status: '미확인',
        visited: false,
        rating: null,
        memo: null,
        map_url: 'https://map.naver.com/v5/search?query=대엽을지로&c=37.5667,126.9970,15,0,0,0,dh',
        user_id: testUserId
      },
      {
        name: '서관면옥 신세계백화점',
        district: '중구',
        address: '서울 중구 소공로 63',
        price: 17000,
        solo_status: '미확인',
        visited: false,
        rating: null,
        memo: null,
        map_url: 'https://map.naver.com/v5/search?query=서관면옥신세계&c=37.5627,126.9709,15,0,0,0,dh',
        user_id: testUserId
      },
      {
        name: '북창옥 시청 본점',
        district: '중구',
        address: '서울 중구 삼일대로 3',
        price: 15000,
        solo_status: '미확인',
        visited: false,
        rating: null,
        memo: null,
        map_url: 'https://map.naver.com/v5/search?query=북창옥시청&c=37.5660,126.9773,15,0,0,0,dh',
        user_id: testUserId
      }
    ];

    console.log('🥘 초기 데이터 5개 추가 중...');
    const { data, error } = await supabase
      .from('restaurants')
      .insert(initialData)
      .select();

    if (error) {
      console.error('❌ 에러:', error.message);
      return;
    }

    console.log('✅ 평양냉면 테이블 설정 완료!');
    console.log('\n📊 저장된 평양냉면 목록:');
    console.table(data);

  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

setupPyeongnaeng();
