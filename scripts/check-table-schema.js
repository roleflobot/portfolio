const { createClient } = require('@supabase/supabase-js');
require('./load-env')();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase 환경변수가 없습니다. .env.local을 확인하세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  try {
    console.log('🔍 현재 restaurants 테이블 구조 확인 중...');

    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ 테이블 조회 실패:', error.message);
      return;
    }

    if (data && data.length > 0) {
      console.log('📊 현재 테이블의 컬럼들:');
      console.log(Object.keys(data[0]));
    } else {
      console.log('테이블은 있지만 데이터가 없습니다.');
    }
  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

checkSchema();
