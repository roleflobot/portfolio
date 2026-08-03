const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tyfacrovbcwpnuudqeus.supabase.co';
const supabaseAnonKey = 'sb_publishable_uwAtdt5ZWeE_CQy9J6H_KA_0DrasmPJ';

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
