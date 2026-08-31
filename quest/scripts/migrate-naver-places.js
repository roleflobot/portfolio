#!/usr/bin/env node
/**
 * 기존 식당 데이터에 네이버 장소 좌표 정보를 채우는 일회성 마이그레이션.
 *
 * 이 스크립트는 브라우저에서 호출할 수 있는 공개 API가 아니라, service_role 키로
 * 로컬에서 직접 실행하는 관리자 전용 작업이다.
 *
 * 사용법:
 *   node scripts/migrate-naver-places.js            # dry-run (DB에 아무 것도 쓰지 않음)
 *   node scripts/migrate-naver-places.js --apply     # 실제로 DB에 반영
 *
 * 안전장치:
 *   - naver_link_source가 'manual'인 행은 절대 건드리지 않는다.
 *   - naver_matched_at이 이미 있는 행은 건드리지 않는다 (재실행해도 중복 호출/수정 없음).
 *   - EXCLUDED_IDS에 있는 행(사용자가 예전에 직접 확인해둔 초기 10개)은 무조건 건너뛴다.
 *   - 서울 주소가 아닌 후보는 전부 제외한다.
 *   - 상호명이 일치하는 후보가 하나도 없으면 자동 연결하지 않고 review_required로 남긴다.
 */

const { createClient } = require('@supabase/supabase-js');
require('./load-env')();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const APP_URL = 'https://quest-theta-cyan.vercel.app';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
  console.error('❌ 환경변수(.env.local)가 부족합니다.');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');

// 사용자가 예전에 직접 검색해서 확인한 초기 10개 식당 — 절대 재검색/수정하지 않는다.
const EXCLUDED_IDS = [49, 50, 51, 52, 53, 54, 55, 56, 57, 58];

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function stripHtml(text) {
  return text.replace(/<[^>]+>/g, '');
}

function normalize(text) {
  return text.replace(/\s+/g, '').toLowerCase();
}

function isSeoulAddress(item) {
  return (item.address || '').includes('서울특별시') || (item.roadAddress || '').includes('서울특별시');
}

function buildWebSearchUrl(placeName) {
  return 'https://map.naver.com/p/search/' + encodeURIComponent(placeName + ' 냉면');
}

function buildNmapUrl(lat, lng, placeName) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    name: placeName,
    appname: APP_URL,
  });
  return 'nmap://place?' + params.toString();
}

async function searchNaverLocal(query) {
  const url =
    'https://naverapihub.apigw.ntruss.com/search/v1/local?' +
    new URLSearchParams({ query, display: '5' });

  const res = await fetch(url, {
    headers: {
      'X-NCP-APIGW-API-KEY-ID': NAVER_CLIENT_ID,
      'X-NCP-APIGW-API-KEY': NAVER_CLIENT_SECRET,
    },
  });

  if (!res.ok) {
    throw new Error('네이버 지역 검색 API 오류: ' + res.status);
  }

  const json = await res.json();
  return json.items || [];
}

async function findBestSeoulMatch(name, address, district) {
  // 주소에 층/호수 정보가 섞이면 네이버 지역검색 API가 0건을 반환하는 경우가 있어
  // 검색어는 상세 주소 대신 자치구를 사용한다.
  const query = (name + ' ' + (district || '')).trim();
  const items = await searchNaverLocal(query);
  const seoulItems = items.filter(isSeoulAddress);

  const candidates = seoulItems.map((item) => {
    const cleanName = stripHtml(item.title);
    const nameMatch =
      normalize(name).length > 0 &&
      (normalize(cleanName).includes(normalize(name)) || normalize(name).includes(normalize(cleanName)));
    const addressText = item.roadAddress || item.address;
    const addressMatch = (district || '').trim().length > 0 && addressText.includes(district.trim());

    const lat = Number(item.mapy) / 1e7;
    const lng = Number(item.mapx) / 1e7;

    return {
      name: cleanName,
      category: item.category,
      address: item.address,
      roadAddress: item.roadAddress,
      lat,
      lng,
      nameMatch,
      addressMatch,
      score: (nameMatch ? 2 : 0) + (addressMatch ? 1 : 0),
    };
  });

  candidates.sort((a, b) => b.score - a.score);

  const best = candidates.find((c) => c.nameMatch);
  return { best, totalCandidates: items.length, seoulCandidates: candidates.length };
}

async function main() {
  console.log(APPLY ? '🚀 실제 반영 모드로 실행합니다.\n' : '🔍 DRY-RUN 모드 (DB에는 아무것도 쓰지 않습니다)\n');

  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select('id, name, address, district, map_url, naver_link_source, naver_matched_at')
    .order('id', { ascending: true });

  if (error) {
    console.error('❌ 목록 조회 실패:', error.message);
    process.exit(1);
  }

  const summary = { success: 0, manualPreserved: 0, excluded: 0, alreadyDone: 0, reviewRequired: 0, searchFailed: 0 };

  for (const r of restaurants) {
    if (EXCLUDED_IDS.includes(r.id)) {
      summary.excluded++;
      console.log(`⏭️  [${r.id}] ${r.name} — 보존 대상 목록에 있어 건너뜀`);
      continue;
    }

    if (r.naver_link_source === 'manual') {
      summary.manualPreserved++;
      console.log(`🔒 [${r.id}] ${r.name} — 수동 링크 보존, 건너뜀`);
      continue;
    }

    if (r.naver_matched_at) {
      summary.alreadyDone++;
      console.log(`✅ [${r.id}] ${r.name} — 이미 처리됨 (${r.naver_matched_at}), 건너뜀`);
      continue;
    }

    try {
      const { best, totalCandidates, seoulCandidates } = await findBestSeoulMatch(
        r.name,
        r.address,
        r.district
      );

      if (!best) {
        summary.reviewRequired++;
        console.log(
          `⚠️  [${r.id}] ${r.name} — 확실한 서울 지역 매칭 없음 (전체 ${totalCandidates}건, 서울 ${seoulCandidates}건) -> review_required`
        );
        if (APPLY) {
          await supabase
            .from('restaurants')
            .update({ naver_match_status: 'review_required', naver_matched_at: new Date().toISOString() })
            .eq('id', r.id);
        }
        continue;
      }

      const nmapUrl = buildNmapUrl(best.lat, best.lng, best.name);
      const webUrl = buildWebSearchUrl(best.name);

      console.log(
        `✨ [${r.id}] ${r.name} -> ${best.name} | ${best.roadAddress || best.address} | ${best.category} | score=${best.score}`
      );

      if (APPLY) {
        const update = {
          naver_place_name: best.name,
          naver_category: best.category,
          naver_address: best.address,
          naver_road_address: best.roadAddress,
          naver_mapx: best.lng,
          naver_mapy: best.lat,
          naver_map_url: nmapUrl,
          naver_link_source: 'auto',
          naver_matched_at: new Date().toISOString(),
          naver_match_status: 'matched',
        };
        // map_url이 비어있을 때만 웹 검색 링크로 채운다 (기존 값은 절대 덮어쓰지 않음)
        if (!r.map_url) {
          update.map_url = webUrl;
        }
        const { error: updateError } = await supabase.from('restaurants').update(update).eq('id', r.id);
        if (updateError) {
          console.error(`   ❌ 저장 실패: ${updateError.message}`);
          continue;
        }
      }

      summary.success++;
    } catch (err) {
      summary.searchFailed++;
      console.error(`❌ [${r.id}] ${r.name} — 검색 실패: ${err.message}`);
    }

    // 네이버 API 호출 간 짧은 지연 (연속 호출 과부하 방지)
    await new Promise((res) => setTimeout(res, 150));
  }

  console.log('\n===== 결과 요약 =====');
  console.log('성공(자동 연결):', summary.success);
  console.log('수동 링크 보존:', summary.manualPreserved);
  console.log('초기 10개 보존(제외):', summary.excluded);
  console.log('이미 처리됨(건너뜀):', summary.alreadyDone);
  console.log('검토 필요(review_required):', summary.reviewRequired);
  console.log('검색 실패:', summary.searchFailed);
  console.log(APPLY ? '\n실제로 DB에 반영되었습니다.' : '\nDRY-RUN이었습니다. 실제로 반영하려면 --apply 옵션을 붙여 다시 실행하세요.');
}

main();
