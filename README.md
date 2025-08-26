# ✈️ 항공편 데이터 관리 시스템

크루월드에서 항공편 정보를 스크래핑하여 Turso 클라우드 데이터베이스에 저장하고 관리하는 웹 애플리케이션입니다.

## 🔐 보안 기능

- **Google OAuth 인증**: 안전한 Google 계정 기반 로그인
- **개인별 데이터 분리**: 각 사용자는 자신의 데이터만 접근 가능
- **세션 기반 인증**: Passport.js를 사용한 안전한 세션 관리
- **JWT 토큰**: 추가적인 보안 레이어
- **인증 미들웨어**: 모든 데이터 접근에 인증 필요

## 🚀 주요 기능

- **Google OAuth 로그인**: Google 계정으로 간편한 로그인
- **Excel 파일 업로드**: 월간 스케줄 Excel 파일 업로드 및 파싱
- **클라우드 저장**: Turso 데이터베이스에 안전한 데이터 저장
- **월별 조회**: 저장된 데이터를 월별로 조회
- **개인별 데이터 관리**: 본인의 데이터만 접근 및 관리

## 🛠️ 기술 스택

- **Backend**: Node.js, Express
- **Database**: Turso (SQLite 기반 클라우드 DB)
- **Authentication**: Google OAuth 2.0, Passport.js, JWT
- **File Processing**: Multer (파일 업로드), XLSX (Excel 파싱)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Deployment**: Render

## 📋 설치 및 설정

### 1. 프로젝트 클론
```bash
git clone <repository-url>
cd flightdashboard
```

### 2. 의존성 설치
```bash
npm install
```

### 3. Google OAuth 설정

#### Google Cloud Console에서 OAuth 2.0 클라이언트 생성
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. "API 및 서비스" > "사용자 인증 정보" 메뉴로 이동
4. "사용자 인증 정보 만들기" > "OAuth 2.0 클라이언트 ID" 선택
5. 애플리케이션 유형: "웹 애플리케이션" 선택
6. 승인된 리디렉션 URI 추가:
   - 개발: `http://localhost:3000/auth/google/callback`
   - 프로덕션: `https://your-domain.vercel.app/auth/google/callback`

### 4. Turso 데이터베이스 설정

#### Turso CLI 설치
```bash
curl -sSfL https://get.turso/install.sh | bash
```

#### Turso 로그인
```bash
turso auth login
```

#### 데이터베이스 생성
```bash
turso db create flight-dashboard
```

#### 데이터베이스 URL 확인
```bash
turso db show flight-dashboard
```

#### 인증 토큰 생성
```bash
turso db tokens create flight-dashboard
```

### 5. 환경변수 설정

`.env` 파일 생성:
```env
TURSO_DATABASE_URL=libsql://your-database-url.turso.io
TURSO_AUTH_TOKEN=your-auth-token
JWT_SECRET=your-super-secret-jwt-key
SESSION_SECRET=your-session-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

### 6. 로컬 실행
```bash
npm start
```

## 🚀 Render 배포

### 1. Render 계정 생성
1. [Render.com](https://render.com)에서 계정 생성
2. GitHub 저장소 연결

### 2. Web Service 생성
1. "New +" > "Web Service" 선택
2. GitHub 저장소 연결
3. 서비스 설정:
   - **Name**: flight-dashboard
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node app.js`

### 3. 환경변수 설정
Render 대시보드에서 다음 환경변수 설정:
```
NODE_ENV=production
SESSION_SECRET=your-session-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
TURSO_DATABASE_URL=your-turso-database-url
TURSO_AUTH_TOKEN=your-turso-auth-token
```

### 4. Google OAuth 콜백 URL 업데이트
배포 후 생성된 도메인으로 Google Cloud Console의 승인된 리디렉션 URI를 업데이트:
```
https://your-app-name.onrender.com/auth/google/callback
```

### 5. 자동 배포
GitHub에 푸시하면 자동으로 배포됩니다.

## 📊 데이터 구조

### 사용자 테이블 (users)
- `id`: 고유 식별자
- `google_id`: Google OAuth ID (고유)
- `username`: 사용자명
- `email`: 이메일 (고유)
- `display_name`: 표시 이름
- `profile_picture`: 프로필 이미지 URL
- `created_at`: 계정 생성 시간
- `last_login`: 마지막 로그인 시간

### 월간 스케줄 테이블 (monthly_schedule)
- `id`: 고유 식별자
- `date`: 스케줄 날짜 (예: 09/01(월))
- `flight`: 항공편 번호 또는 업무 유형 (예: 561, A350 B-TY, DAY OFF)
- `show_up`: 쇼업 시간 (예: 04 11:00)
- `sector`: 노선 (예: ICN/FCO)
- `std`: Scheduled Time of Departure (예: 04 12:20)
- `sta`: Scheduled Time of Arrival (예: 04 18:30)
- `empl`: 직원 번호 (예: 123456)
- `name`: 직원 이름
- `rank`: 직급 (예: CAP, F/O)
- `posn_type`: 포지션 타입 (예: TL, CR)
- `posn`: 포지션 (예: F, F2, C, C2)
- `month_year`: 월별 구분 (YYYY-MM)
- `user_id`: 사용자 ID (외래키)
- `created_at`: 생성 시간
- `updated_at`: 업데이트 시간

## 🔧 API 엔드포인트

### 인증
- `GET /auth/google`: Google OAuth 로그인 시작
- `GET /auth/google/callback`: Google OAuth 콜백 처리
- `POST /api/logout`: 로그아웃
- `GET /api/auth/status`: 인증 상태 확인

### 파일 업로드 (인증 필요)
- `POST /api/upload-excel`: Excel 파일 업로드 및 데이터 저장

### 데이터 조회 (인증 필요)
- `GET /api/flights/:monthYear`: 월별 스케줄 데이터 조회

## 🎯 사용 방법

### 1. Google OAuth 로그인
1. `/login` 페이지에서 "Google로 로그인" 버튼 클릭
2. Google 계정 선택 및 권한 승인
3. 자동으로 메인 대시보드로 리디렉트

### 2. Excel 파일 업로드
1. Excel 파일(.xls, .xlsx) 선택
2. 데이터 월 선택 (이번달/다음달)
3. "파일 업로드 및 저장" 버튼 클릭
4. 업로드 완료 후 데이터 자동 새로고침

### 3. 데이터 조회
1. 월 선택 드롭다운에서 원하는 월 선택
2. "데이터 조회" 버튼 클릭
3. 해당 월의 스케줄 데이터 확인

### 4. 로그아웃
1. 상단의 "로그아웃" 버튼 클릭
2. 로그인 페이지로 자동 이동

## 🔒 보안 특징

- **Google OAuth 2.0**: 업계 표준 OAuth 인증
- **개인별 데이터 분리**: 각 사용자는 자신의 데이터만 접근
- **세션 관리**: Passport.js를 통한 안전한 세션 관리
- **JWT 토큰**: 추가 보안 레이어
- **HTTPS**: 프로덕션에서 안전한 연결
- **인증 미들웨어**: 모든 데이터 접근에 인증 필요

## ⚠️ 주의사항

- 크루월드 로그인 정보는 서버에 저장되지 않습니다
- 매번 업데이트 시 로그인 정보를 입력해야 합니다
- Render 무료 플랜에서는 일정 시간 후 서비스가 슬립 모드로 전환됩니다
- Puppeteer 사용 시 Render에서 정상적으로 작동합니다
- 각 사용자는 자신의 데이터만 접근할 수 있습니다
- Google OAuth 콜백 URL은 배포 도메인에 맞게 설정해야 합니다

## 📈 성능 최적화

- 데이터베이스 인덱스 최적화
- 월별 데이터 분할 저장
- 사용자별 데이터 분리
- 비동기 스크래핑 처리
- 실시간 진행 상황 모니터링

## 🐛 문제 해결

### 일반적인 오류

1. **Google OAuth 오류**
   - Google Cloud Console에서 OAuth 클라이언트 설정 확인
   - 승인된 리디렉션 URI 확인
   - 클라이언트 ID와 시크릿 확인

2. **인증 오류**
   - 로그인 상태 확인
   - 세션 만료 시 재로그인

3. **데이터베이스 연결 오류**
   - Turso URL과 토큰 확인
   - 네트워크 연결 상태 확인

4. **스크래핑 실패**
   - 크루월드 로그인 정보 확인
   - 사이트 접근 권한 확인

5. **Render 배포 오류**
   - 환경변수 설정 확인
   - 서비스 상태 확인

## 📞 지원

문제가 발생하거나 질문이 있으시면 이슈를 생성해주세요.

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.
