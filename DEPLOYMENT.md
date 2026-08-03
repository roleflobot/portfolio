# 🚀 Pyeongnaeng Solo Quest - 배포 및 자동화 가이드

## 📋 현재 설정 상태

### ✅ 완성된 자동화

1. **로컬 초기화 (npm run setup)**
   - 기존 데이터 자동 삭제
   - 평양냉면 초기 데이터 5개 추가
   - Supabase와 완전 연동

2. **GitHub - Vercel 자동 배포**
   - main 브랜치 푸시 → 자동 배포
   - 환경변수 자동 적용
   - 배포 완료 후 즉시 반영

3. **환경변수 관리**
   - 로컬: `.env.local` (Git 제외)
   - Vercel: 자동 설정됨 (보안)
   - 스크립트: 환경변수에서 자동 로드

---

## 🔄 워크플로우

### 개발 단계

```bash
# 1. 로컬에서 개발
npm run dev
# http://localhost:3000 에서 테스트

# 2. 변경사항 커밋
git add .
git commit -m "기능명: 설명"

# 3. GitHub에 푸시 (자동 배포)
git push origin main
```

### 배포 후

- ✅ Vercel이 자동으로 빌드 시작
- ✅ 1-2분 후 배포 완료
- ✅ https://quest-theta-cyan.vercel.app 자동 갱신

---

## 📝 주요 파일

| 파일 | 용도 |
|------|------|
| `.env.local` | 로컬 환경변수 (Git 제외) |
| `.env.local.example` | 환경변수 템플릿 |
| `vercel.json` | Vercel 배포 설정 |
| `scripts/full-setup.js` | 자동 초기화 스크립트 |

---

## 🔐 환경변수 설정 (Vercel)

**이미 자동 설정됨:**
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

새 환경변수를 추가해야 하면:
```bash
# Vercel CLI 사용 (권장)
vercel env add KEY_NAME

# 또는 Vercel 대시보드
https://vercel.com/roleflobot/quest/settings/environment-variables
```

---

## 🧪 로컬 테스트

```bash
# 1. 개발 서버 시작
npm run setup
npm run dev

# 2. 기능 테스트
# http://localhost:3000 에서 모든 기능 확인

# 3. 데이터 초기화 (필요시)
npm run setup
```

---

## 📊 모니터링

**배포 상태 확인:**
- Vercel Dashboard: https://vercel.com/roleflobot/quest
- GitHub Actions: https://github.com/roleflobot/quest/actions
- 배포 로그: Vercel Dashboard → Deployments

---

## ✨ 완전자동화 체크리스트

- ✅ GitHub - Vercel 연동
- ✅ 환경변수 자동 관리
- ✅ npm run setup으로 로컬 초기화
- ✅ main 푸시 → 자동 배포
- ✅ vercel.json으로 배포 설정 코드화
- ✅ .env.local.example로 템플릿 관리

---

## 🎯 다음 단계

1. **4단계**: 상세 조회/수정/삭제 기능
2. **5단계**: 사용자 인증 (로그인)
3. **6단계**: 평점 및 메모 기능
4. **7단계**: 완전 프로덕션 배포

---

**생성일**: 2026-08-03  
**상태**: 완전자동화 ✅
