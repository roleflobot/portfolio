#!/usr/bin/env node

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

async function cleanTempData() {
  try {
    console.log('🧹 임시 데이터 삭제 중...\n');

    // 삭제할 식당명
    const tempRestaurants = [
      '신라면집',
      'BBQ치킨',
      '국밥전문점',
      '짬뽕전문점',
      '평양면옥',
      '테스트식당'
    ];

    for (const name of tempRestaurants) {
      const { error } = await supabase
        .from('restaurants')
        .delete()
        .eq('name', name);

      if (error) {
        console.error(`❌ '${name}' 삭제 실패: ${error.message}`);
      } else {
        console.log(`✅ '${name}' 삭제 완료`);
      }
    }

    console.log('\n🎉 임시 데이터 모두 삭제 완료!');
    console.log('📍 Vercel이 자동 배포됨 (1-2분 후 반영)');

  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  }
}

cleanTempData();
