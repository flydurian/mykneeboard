# 🔒 보안 정책

## API 키 보호

이 프로젝트는 모든 민감한 API 키를 **Vercel 환경변수**에 안전하게 저장합니다.

### ✅ 보호되는 API 키 (서버 사이드)

다음 API 키들은 **절대 클라이언트에 노출되지 않습니다**:

| 환경변수 | 용도 | 보호 방식 |
|---------|------|----------|
| `RAPIDAPI_KEY` | AeroDataBox API | Vercel 서버리스 함수 전용 |
| `INCHEON_API_KEY` | 인천공항 API | Vercel 서버리스 함수 전용 |
| `CHECKWX_API_KEY` | METAR/TAF 기상정보 | Vercel 서버리스 함수 전용 |
| `OPENWEATHER_API_KEY` | 날씨 정보 | Vercel 서버리스 함수 전용 |
| `AQICN_API_KEY` | 대기질 정보 | Vercel 서버리스 함수 전용 |
| `EXCHANGE_API_KEY` | 환율 정보 | Vercel 서버리스 함수 전용 |

### 🛡️ 보호 메커니즘

```
클라이언트 (브라우저)
    ↓ fetch('/api/aerodatabox-search', ...)
Vercel 서버리스 함수
    ↓ const apiKey = process.env.RAPIDAPI_KEY (서버에서만 접근)
    ↓ fetch('https://api.aerodatabox.com', { headers: { 'X-RapidAPI-Key': apiKey } })
외부 API
    ↓ 응답 데이터
Vercel 서버리스 함수
    ↓ return response.json(data)
클라이언트 (브라우저)
    ↓ 결과만 받음 (API 키는 절대 노출 안됨)
```

### ⚠️ 공개 설정 (Firebase)

`VITE_` 프리픽스가 붙은 환경변수는 클라이언트에 노출됩니다:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`

**이것은 안전합니다!** Firebase는 이러한 설정이 공개되도록 설계되었으며, 실제 보안은 Firebase Security Rules로 관리됩니다.

## 보안 체크리스트

### 개발자

- [ ] `.env` 파일을 절대 커밋하지 않기
- [ ] API 키를 코드에 하드코딩하지 않기
- [ ] 서버 사이드 환경변수에는 `VITE_` 프리픽스 사용하지 않기
- [ ] 민감한 데이터를 로그에 출력하지 않기

### 배포 관리자

- [ ] Vercel 대시보드에서 모든 환경변수 설정
- [ ] Production, Preview, Development 모두에 환경변수 적용
- [ ] 환경변수 변경 시 반드시 Redeploy
- [ ] 정기적으로 API 키 로테이션 (3-6개월)

### 코드 리뷰어

- [ ] API 키가 코드에 없는지 확인
- [ ] 서버리스 함수에서만 API 호출하는지 확인
- [ ] 민감한 데이터가 응답에 포함되지 않는지 확인
- [ ] CORS 설정이 적절한지 확인

## 취약점 신고

보안 취약점을 발견하셨다면:

1. **공개 이슈로 신고하지 마세요**
2. 프로젝트 관리자에게 직접 연락
3. 발견한 취약점의 세부사항 제공
4. 패치가 적용될 때까지 비공개 유지

## 보안 사고 대응

### API 키 노출 시

1. ⚠️ **즉시 해당 API 서비스에서 키를 무효화**
2. 새 API 키 발급
3. Vercel 환경변수 업데이트
4. Git 히스토리에서 제거 (필요 시)
   ```bash
   # BFG Repo-Cleaner 사용
   bfg --replace-text passwords.txt
   git reflog expire --expire=now --all && git gc --prune=now --aggressive
   ```
5. 모든 팀원에게 알림
6. Redeploy

### 의심스러운 API 사용 패턴 발견 시

1. Vercel Logs에서 API 호출 패턴 확인
2. Rate Limiting 확인 (이미 구현됨)
3. 필요 시 일시적으로 API 차단
4. Firebase Security Rules 재검토

## 구현된 보안 기능

### ✅ Rate Limiting

모든 API 엔드포인트에 Rate Limiting 적용:

```typescript
// 예시: api/weather.ts
const RATE_LIMIT_WINDOW = 60 * 1000; // 1분
const RATE_LIMIT_MAX_REQUESTS = 10; // 1분당 최대 10회
```

### ✅ CORS 설정

허용된 도메인만 API 접근 가능:

```typescript
const allowedOrigins = [
  'https://mykneeboard.vercel.app',
  'http://localhost:5173',
  'capacitor://localhost'
];
```

### ✅ 환경변수 검증

서버 시작 시 필수 환경변수 확인:

```typescript
if (!process.env.RAPIDAPI_KEY) {
  console.error('❌ RAPIDAPI_KEY 환경변수가 설정되지 않았습니다.');
  return response.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
}
```

### ✅ Firebase Security Rules

데이터베이스 접근 제한 (`database.rules.json`):

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

## 참고 자료

- [Vercel 환경변수 설정](https://vercel.com/docs/concepts/projects/environment-variables)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [API 키 보안 Best Practices](https://cloud.google.com/docs/authentication/api-keys)

