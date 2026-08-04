const { createClient } = require('@supabase/supabase-js');
require('./load-env')();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase 환경변수가 없습니다. .env.local을 확인하세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function addRestaurant() {
  try {
    console.log('🍽️ 맛집 추가 중...');

    const newRestaurant = {
      name: '짬뽕전문점',
      food: '짬뽕',
      rating: 5
    };

    const { data, error } = await supabase
      .from('restaurants')
      .insert([newRestaurant])
      .select();

    if (error) {
      console.error('❌ 에러:', error.message);
      return;
    }

    console.log('✅ 맛집이 추가되었습니다!');
    console.log('📊 추가된 데이터:');
    console.table(data);
  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

addRestaurant();
