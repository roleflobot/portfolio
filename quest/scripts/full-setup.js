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

// 6단계(로그인/RLS) 이후로는 모든 식당이 실제 로그인 사용자 소유여야 한다.
// 이 스크립트는 더 이상 가짜 user_id로 초기 데이터를 채우지 않는다.
// 로컬 개발용으로 전체 데이터를 비우고 싶을 때만 사용한다.
async function resetData() {
  try {
    console.log('🗑️  restaurants 테이블 데이터 삭제 중...\n');

    const { error } = await supabase.from('restaurants').delete().gte('id', 0);

    if (error) {
      console.error('❌ 삭제 실패:', error.message);
      process.exit(1);
    }

    console.log('✅ 삭제 완료!\n');
    console.log('📍 다음 단계:');
    console.log('   1. npm run dev 로 서버 시작');
    console.log('   2. /login 에서 회원가입 후 로그인');
    console.log('   3. "+ 식당 등록"으로 직접 식당을 추가하세요\n');
  } catch (error) {
    console.error('❌ 실패:', error.message);
    process.exit(1);
  }
}

resetData();
