<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# MyKneeBoard

비행사들을 위한 종합 비행 대시보드 애플리케이션입니다.

## 주요 기능

- 월별 비행 시간 관리
- 휴식 시간 계산기
- 항공편 검색 (인천공항 API + 오프라인 DB)
- 항공사 정보 검색
- 실시간 네트워크 상태 감지

## 기술 스택

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Vercel Serverless Functions
- **API**: 인천공항 API, CheckWX API, OpenWeatherMap API
- **Database**: Firebase Realtime Database
- **Deployment**: Vercel

## Vercel 서버리스 함수 설정

### 환경 변수 설정

Vercel 대시보드에서 다음 환경 변수를 설정하세요:

```bash
# 인천공항 API
INCHEON_API_KEY=your_incheon_api_key_here

# CheckWX API (METAR/TAF)
CHECKWX_API_KEY=your_checkwx_api_key_here

# OpenWeatherMap API
OPENWEATHER_API_KEY=your_openweather_api_key_here

# Firebase 설정
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

- **항공편 검색**: `/api/incheon/flights`
- **기상 정보**: `/api/metar`
- **날씨 정보**: `/api/weather`
- **일출/일몰**: `/api/sunrise`

## 로컬 개발

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build
```

## 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel

# 프로덕션 배포
vercel --prod
```

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
