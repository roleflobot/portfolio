const { Client } = require('pg');
require('./load-env')();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const databasePassword = process.env.SUPABASE_DB_PASSWORD;

let projectRef;
try {
  projectRef = new URL(supabaseUrl).hostname.split('.')[0];
} catch {
  // 아래의 공통 환경변수 오류로 처리한다.
}

if (!projectRef || !databasePassword) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_DB_PASSWORD가 없습니다.');
  console.error('   .env.local 파일을 확인하세요.');
  process.exit(1);
}

const client = new Client({
  host: `db.${projectRef}.supabase.co`,
  user: 'postgres',
  password: databasePassword,
  database: 'postgres',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('🚀 완전자동화 마이그레이션 시작!\n');

    await client.connect();
    console.log('✅ PostgreSQL 연결 완료!\n');

    console.log('📊 테이블 컬럼 추가 중...');

    const queries = [
      'ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS district TEXT;',
      'ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS address TEXT;',
      'ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS price INTEGER;',
      'ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS solo_status TEXT DEFAULT \'미확인\';',
      'ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS visited BOOLEAN DEFAULT false;',
      'ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS memo TEXT;',
      'ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS map_url TEXT;',
      'ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS user_id UUID;'
    ];

    for (const query of queries) {
      await client.query(query);
    }

    console.log('✅ 모든 컬럼 추가 완료!\n');
    console.log('🎉 마이그레이션 성공!\n');
    console.log('다음 단계: node scripts/migrate-to-pyeongnaeng.js');

    await client.end();
  } catch (error) {
    console.error('❌ 에러:', error.message);
    process.exit(1);
  }
}

migrate();
