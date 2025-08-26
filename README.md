<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Pilot Flight Dashboard

비행사용 비행 대시보드 애플리케이션입니다.

## 🚀 Vercel 배포 가이드

### 1. Vercel CLI 설치 (선택사항)
```bash
npm i -g vercel
```

### 2. Firebase 설정
이 프로젝트는 Firebase Realtime Database를 사용합니다. Firebase 프로젝트가 이미 설정되어 있으며, 실시간 데이터 동기화가 가능합니다.

#### 데이터 구조
비행 데이터는 사용자별로 분리되어 월별로 자동 분류되어 저장됩니다:
```
users/
├── [사용자ID1]/
│   └── flights/
│       ├── 2024/
│       │   ├── 01/ (1월)
│       │   ├── 02/ (2월)
│       │   └── ...
│       └── 2025/
│           ├── 01/ (1월)
│           └── ...
└── [사용자ID2]/
    └── flights/
        └── ...
```

#### 보안
- 각 사용자는 자신의 데이터만 접근 가능
- Firebase Authentication을 통한 사용자 인증
- Firebase Realtime Database 보안 규칙으로 데이터 보호

### 3. 배포 방법

#### 방법 1: Vercel 대시보드 사용
1. [Vercel](https://vercel.com)에 로그인
2. "New Project" 클릭
3. GitHub 저장소 연결
4. 환경 변수 설정
5. "Deploy" 클릭

#### 방법 2: Vercel CLI 사용
```bash
# 프로젝트 루트에서
vercel

# 프로덕션 배포
vercel --prod
```

### 4. 로컬 개발
```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 미리보기
npm run preview
```

## 📁 프로젝트 구조
```
├── components/          # React 컴포넌트
│   ├── modals/         # 모달 컴포넌트
│   └── ...
├── utils/              # 유틸리티 함수
├── types.ts            # TypeScript 타입 정의
├── constants.ts        # 상수 정의
└── ...
```

## 🔧 기술 스택
- React 19
- TypeScript
- Vite
- Firebase Realtime Database
