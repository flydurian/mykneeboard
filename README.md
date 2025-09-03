<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Pilot Flight Dashboard

비행사들을 위한 종합 비행 대시보드 애플리케이션입니다.

## 주요 기능

- 월별 비행 시간 관리
- 휴식 시간 계산기
- 항공편 검색 (Amadeus API + 구글 스프레드시트)
- 항공사 정보 검색
- 실시간 네트워크 상태 감지

## 기술 스택

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Vercel Serverless Functions
- **API**: Amadeus Flight Search API
- **Database**: Firebase Realtime Database
- **Deployment**: Vercel

## Vercel 서버리스 함수 설정

### 환경 변수 설정

Vercel 대시보드에서 다음 환경 변수를 설정하세요:

```bash
AMADEUS_CLIENT_ID=UgrWkt3n3EpU7hZnPwISgm1Y69tYVz77
AMADEUS_CLIENT_SECRET=19zDwNkLrepKXgFI
```

### API 엔드포인트

- **토큰 인증**: `/api/amadeus/token`
- **항공편 검색**: `/api/amadeus/flights`

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

## API 사용법

### 온라인 모드
- Amadeus API를 통한 실시간 항공편 검색
- 공항 코드 (ICN, NRT 등) 또는 항공사 코드 (KE, OZ 등)로 검색

### 오프라인 모드
- 구글 스프레드시트를 통한 항공편 정보 검색
- 국제선/국내선 스케줄 데이터 활용

## 라이선스

MIT License
