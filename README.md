<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# MyKneeBoard

비행사들을 위한 종합 비행 대시보드 애플리케이션입니다.

> 🔒 **보안**: 모든 API 키는 Vercel 환경변수에 안전하게 저장되며, 클라이언트 코드에 절대 노출되지 않습니다. 자세한 내용은 [SECURITY.md](./SECURITY.md)를 참고하세요.

## 주요 기능

- 월별 비행 시간 관리
- 휴식 시간 계산기
- 항공편 검색 (AeroDataBox API → 인천공항 API → 오프라인 DB)
- 항공사 정보 검색
- 실시간 네트워크 상태 감지

## 기술 스택

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Vercel Serverless Functions
- **API**: AeroDataBox (RapidAPI), 인천공항 API, CheckWX API, OpenWeatherMap API
- **Database**: Firebase Realtime Database
- **Deployment**: Vercel

## Vercel 서버리스 함수 설정

### 환경 변수 설정

> 📖 **상세 설정 가이드**: [VERCEL_SETUP.md](./VERCEL_SETUP.md) - 자동 스크립트 포함!

Vercel 대시보드에서 다음 환경 변수를 설정하세요:

```bash
# RapidAPI (AeroDataBox - 항공편 검색)
RAPIDAPI_KEY=your_rapidapi_key_here

# 인천공항 API (항공편 검색 백업)
INCHEON_API_KEY=your_incheon_api_key_here

# CheckWX API (METAR/TAF)
CHECKWX_API_KEY=your_checkwx_api_key_here

# OpenWeatherMap API (날씨 정보)
OPENWEATHER_API_KEY=your_openweather_api_key_here

# AQICN API (대기질 정보)
AQICN_API_KEY=your_aqicn_api_key_here

# Exchange Rate API (환율 정보)
EXCHANGE_API_KEY=your_exchange_api_key_here

# Firebase 설정 (⚠️ VITE_ 프리픽스는 클라이언트에 노출됨 - Firebase는 공개 설정이므로 안전)
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.region.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### API 엔드포인트

- **항공편 검색 (AeroDataBox)**: `/api/aerodatabox-search`
- **항공편 검색 (인천공항)**: `/api/incheon/flights`
- **항공편 경로 추적**: `/api/flight-tracking`
- **기상 정보 (METAR/TAF)**: `/api/metar`
- **날씨 정보**: `/api/weather`
- **대기질 정보**: `/api/air-pollution`
- **일출/일몰**: `/api/sunrise`
- **환율 정보**: `/api/exchange`

## 로컬 개발

### 환경변수 설정 (로컬)

프로젝트 루트에 `.env` 파일을 생성하고 위의 환경변수를 설정하세요.

**중요**: `.env` 파일은 절대 커밋하지 마세요! (이미 `.gitignore`에 포함되어 있습니다)

### 개발 서버 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build
```

### API 키 발급 가이드

1. **RapidAPI (AeroDataBox)**: https://rapidapi.com/aedbx-aedbx/api/aerodatabox
   - 무료 플랜: 월 150회 요청
   
2. **인천공항 API**: https://www.airport.kr/ap_cnt/ko/svc/selectSvcOpenApiGuideList.do
   - 무료, 회원가입 후 발급

3. **CheckWX**: https://www.checkwxapi.com/
   - 무료 플랜: 하루 1,000회 요청

4. **OpenWeatherMap**: https://openweathermap.org/api
   - 무료 플랜: 분당 60회 요청

## 배포

### Vercel 환경변수 설정 (중요!) ⚠️

**자동 설정 스크립트를 사용하세요** (추천):

```bash
# 프로젝트 디렉토리에서 실행
./setup-vercel-env.sh
```

또는 **수동 설정**:

1. Vercel 대시보드 접속: https://vercel.com/dashboard
2. 프로젝트 선택
3. **Settings** → **Environment Variables** 메뉴
4. 위의 모든 환경변수 추가 (RAPIDAPI_KEY, INCHEON_API_KEY 등)
5. 각 환경변수를 **Production**, **Preview**, **Development** 모두에 체크
6. 저장 후 **Redeploy** 필수!

> 📖 **상세 가이드**: [VERCEL_SETUP.md](./VERCEL_SETUP.md)

### Vercel CLI 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel

# 프로덕션 배포
vercel --prod
```

### 배포 후 확인사항

1. ✅ 환경변수가 모두 설정되었는지 확인
2. ✅ API 엔드포인트 작동 테스트
   ```bash
   # AeroDataBox API 테스트
   curl https://your-domain.vercel.app/api/aerodatabox-search
   
   # 환율 API 테스트
   curl https://your-domain.vercel.app/api/exchange?fromCurrency=USD&toCurrency=KRW
   ```
3. ✅ 브라우저 콘솔에서 API 오류 확인

### ⚠️ 환경변수 업데이트 시 주의사항

환경변수를 추가하거나 변경한 경우 **반드시 Redeploy**해야 합니다:

```bash
# Vercel CLI로 Redeploy
vercel --prod

# 또는 Vercel 대시보드에서 "Deployments" → "Redeploy" 버튼 클릭
```

## 🔒 보안 가이드

> 📖 **상세 보안 정책**: [SECURITY.md](./SECURITY.md) 참고

### API 키 보호 방식

이 프로젝트는 모든 민감한 API 키를 **Vercel 환경변수**에 저장하여 보호합니다.

**✅ 모든 API 키는 서버 사이드에서만 사용되며, 클라이언트 코드에 절대 노출되지 않습니다.**

#### ✅ 서버 사이드 환경변수 (안전 - 절대 노출되지 않음)

다음 환경변수들은 **Vercel 서버리스 함수**에서만 사용되며, 클라이언트 코드에 절대 노출되지 않습니다:

```bash
RAPIDAPI_KEY          # RapidAPI (AeroDataBox)
INCHEON_API_KEY       # 인천공항 API
CHECKWX_API_KEY       # CheckWX (METAR/TAF)
OPENWEATHER_API_KEY   # OpenWeatherMap
AQICN_API_KEY         # 대기질 정보
EXCHANGE_API_KEY      # 환율 정보
```

**작동 방식**:
1. 클라이언트에서 `/api/aerodatabox-search` 등의 엔드포인트 호출
2. Vercel 서버리스 함수가 환경변수에서 API 키를 읽음
3. 외부 API 호출 (API 키는 서버에서만 사용)
4. 결과만 클라이언트로 반환

#### ⚠️ 클라이언트 사이드 환경변수 (공개 설정)

`VITE_` 프리픽스가 붙은 환경변수는 **클라이언트 코드에 노출**됩니다:

```bash
VITE_FIREBASE_API_KEY          # Firebase API 키 (공개 설정)
VITE_FIREBASE_AUTH_DOMAIN      # Firebase Auth 도메인
VITE_FIREBASE_DATABASE_URL     # Firebase DB URL
VITE_FIREBASE_PROJECT_ID       # Firebase 프로젝트 ID
```

**주의**: Firebase 설정은 원래 공개되도록 설계되었습니다. Firebase Security Rules로 실제 데이터 접근을 제한하므로 안전합니다.

### 환경변수 설정 체크리스트

#### Vercel 배포 시:

- [ ] Vercel 대시보드에서 **모든 API 키** 환경변수 설정
- [ ] **Production**, **Preview**, **Development** 모두 체크
- [ ] 환경변수 설정 후 **Redeploy** 실행
- [ ] API 키를 절대 Git에 커밋하지 않기
- [ ] `.env` 파일이 `.gitignore`에 포함되어 있는지 확인

#### 로컬 개발 시:

- [ ] 프로젝트 루트에 `.env` 파일 생성
- [ ] 필요한 환경변수 추가
- [ ] `.env` 파일을 **절대 커밋하지 않기**
- [ ] 팀원과 API 키 공유 시 안전한 방법 사용 (1Password, LastPass 등)

### 보안 위반 시 대응

만약 실수로 API 키를 커밋했다면:

1. ⚠️ **즉시 해당 API 키를 무효화**하고 새로 발급
2. Git 히스토리에서 제거 (BFG Repo-Cleaner 사용)
3. 새 API 키로 Vercel 환경변수 업데이트
4. Redeploy

## 트러블슈팅

### 항공편 검색이 작동하지 않는 경우

**증상**: 항공편 검색 시 항상 오프라인 DB 결과만 나옴

**원인**:
1. ❌ `RAPIDAPI_KEY` 환경변수 미설정 → AeroDataBox API 실패
2. ❌ `INCHEON_API_KEY` 환경변수 미설정 → 인천공항 API 실패
3. ❌ 환경변수 설정 후 Redeploy 안함

**해결 방법**:
```bash
# 1. Vercel 대시보드에서 환경변수 확인
# Settings → Environment Variables

# 2. 누락된 환경변수 추가
RAPIDAPI_KEY=your_rapidapi_key_here
INCHEON_API_KEY=your_incheon_api_key_here

# 3. Redeploy
vercel --prod

# 4. 브라우저 콘솔에서 확인
# 항공편 검색 → F12 → Console 탭
# "✅ AeroDataBox API 검색 성공" 또는 "❌" 메시지 확인
```

**브라우저 콘솔 로그 확인**:
- `🔍 항공편 검색 시작:` - 검색 시작
- `📡 1단계: AeroDataBox API 호출...` - AeroDataBox 시도
- `✅ AeroDataBox API 검색 성공: N개` - 성공
- `📡 2단계: 인천공항 API 호출 (백업)...` - 인천공항 시도
- `📂 3단계: 오프라인 DB 검색 (백업)...` - 오프라인 DB 사용

### API 응답 500 오류

**원인**: 환경변수가 설정되지 않음

**해결**:
1. Vercel 대시보드에서 환경변수 설정
2. Production, Preview, Development 모두 체크
3. Redeploy 후 확인

### Vercel 캐시 문제 해결

Vercel의 CDN 캐시로 인한 배포 문제를 해결하기 위해 다음과 같은 최적화가 적용되어 있습니다:

#### 1. 파일 해싱 (File Hashing)
- `vite.config.ts`에서 명시적으로 파일 해싱 활성화
- 빌드 시 모든 자산 파일에 고유 해시값 추가 (예: `index.DaFEDy-o.js`)
- 파일 내용이 변경되면 해시값도 변경되어 강제 업데이트 보장

#### 2. 캐시 헤더 최적화
- `vercel.json`에서 파일 타입별 캐시 정책 설정:
  - **HTML 파일**: 캐시하지 않음 (`no-cache, no-store`)
  - **자산 파일 (JS/CSS)**: 1년 캐시 (`max-age=31536000, immutable`)
  - **서비스 워커**: 즉시 재검증 (`max-age=0, must-revalidate`)

#### 3. 빌드 검증
```bash
# 빌드 및 해시 확인
npm run build:check
```

#### 4. 캐시 문제 발생 시 해결 방법
1. **브라우저 캐시 삭제**: 개발자 도구(F12) → 네트워크 탭 → "캐시 비우기 및 강력 새로고침"
2. **빌드 결과물 확인**: `dist/assets/` 폴더의 파일명에 해시값이 포함되어 있는지 확인
3. **Vercel 재배포**: 필요 시 Vercel 대시보드에서 수동 재배포 실행

## API 사용법

### 온라인 모드
- 인천공항 API를 통한 실시간 항공편 검색
- 공항 코드 (ICN, NRT 등) 또는 항공사 코드 (KE, OZ 등)로 검색

### 오프라인 모드
- 구글 스프레드시트를 통한 항공편 정보 검색
- 국제선/국내선 스케줄 데이터 활용

## 라이선스

MIT License
