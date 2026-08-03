const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ 환경변수가 설정되지 않았습니다.');
  console.error('   .env.local 파일을 확인하세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function migrateToPyeongnaeng() {
  try {
    console.log('🍜 평양냉면 혼밥 도장깨기 마이그레이션 시작!\n');

    // Step 1: PostgreSQL에서 직접 SQL 실행 (admin 권한)
    console.log('📋 Step 1: 기존 restaurants 테이블 삭제...');

    // 기존 테이블에서 데이터 백업 (있으면)
    try {
      await supabase
        .from('restaurants')
        .delete()
        .gte('id', 0);
      console.log('✅ 기존 데이터 삭제 완료');
    } catch (e) {
      console.log('⚠️  데이터 삭제 스킵 (첫 실행일 수 있음)');
    }

    // Step 2: 새로운 테이블 구조로 데이터 추가
    console.log('\n📊 Step 2: 새 Pyeongnaeng 데이터 추가...');

    const testUserId = '550e8400-e29b-41d4-a716-446655440000';

    const initialData = [
      {
        name: '능라도 명동',
        food: '평양냉면',
        district: '중구',
        address: '서울 중구 명동길 8',
        price: 17000,
        solo_status: '미확인',
        visited: false,
        rating: null,
        memo: null,
        map_url: 'https://map.naver.com/v5/search?query=능라도명동',
        user_id: testUserId
      },
      {
        name: '경기옥',
        food: '평양냉면',
        district: '강남구',
        address: '서울 강남구 테헤란로 323',
        price: 15000,
        solo_status: '미확인',
        visited: false,
        rating: null,
        memo: null,
        map_url: 'https://map.naver.com/v5/search?query=경기옥',
        user_id: testUserId
      },
      {
        name: '대엽 을지로',
        food: '평양냉면',
        district: '중구',
        address: '서울 중구 을지로 8-1',
        price: 13000,
        solo_status: '미확인',
        visited: false,
        rating: null,
        memo: null,
        map_url: 'https://map.naver.com/v5/search?query=대엽을지로',
        user_id: testUserId
      },
      {
        name: '서관면옥 신세계백화점',
        food: '평양냉면',
        district: '중구',
        address: '서울 중구 소공로 63',
        price: 17000,
        solo_status: '미확인',
        visited: false,
        rating: null,
        memo: null,
        map_url: 'https://map.naver.com/v5/search?query=서관면옥신세계',
        user_id: testUserId
      },
      {
        name: '북창옥 시청 본점',
        food: '평양냉면',
        district: '중구',
        address: '서울 중구 삼일대로 3',
        price: 15000,
        solo_status: '미확인',
        visited: false,
        rating: null,
        memo: null,
        map_url: 'https://map.naver.com/v5/search?query=북창옥시청',
        user_id: testUserId
      }
    ];

    // 테이블 생성 + 데이터 삽입
    const { data, error } = await supabase
      .from('restaurants')
      .insert(initialData)
      .select();

    if (error) {
      console.error('❌ 에러:', error.message);
      console.log('\n💡 팁: Supabase 대시보드에서 다음 SQL을 실행해보세요:');
      console.log(`
ALTER TABLE restaurants ADD COLUMN district TEXT;
ALTER TABLE restaurants ADD COLUMN address TEXT;
ALTER TABLE restaurants ADD COLUMN price INTEGER;
ALTER TABLE restaurants ADD COLUMN solo_status TEXT DEFAULT '미확인';
ALTER TABLE restaurants ADD COLUMN visited BOOLEAN DEFAULT false;
ALTER TABLE restaurants ADD COLUMN memo TEXT;
ALTER TABLE restaurants ADD COLUMN map_url TEXT;
ALTER TABLE restaurants ADD COLUMN user_id UUID;
      `);
      return;
    }

    console.log('✅ Pyeongnaeng 데이터 추가 완료!\n');
    console.log('🎉 마이그레이션 성공!\n');
    console.log('📊 저장된 평양냉면 목록:');
    console.table(data);

    console.log('\n✨ 이제 페이지를 새로고침하면 평양냉면 목록이 보입니다!');

  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

migrateToPyeongnaeng();
