const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tyfacrovbcwpnuudqeus.supabase.co';
const supabaseAnonKey = 'sb_publishable_uwAtdt5ZWeE_CQy9J6H_KA_0DrasmPJ';

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
