# Vercel 환경변수 설정 가이드

이 문서는 Vercel에 환경변수를 설정하는 방법을 안내합니다.

## 🎯 목표

다음 API 키들을 Vercel 환경변수에 안전하게 저장합니다:

- `RAPIDAPI_KEY` - AeroDataBox API (필수)
- `INCHEON_API_KEY` - 인천공항 API (필수)
- `CHECKWX_API_KEY` - METAR/TAF (선택)
- `OPENWEATHER_API_KEY` - 날씨 정보 (선택)
- `AQICN_API_KEY` - 대기질 정보 (선택)
- `EXCHANGE_API_KEY` - 환율 정보 (필수)

---

## 방법 1: 자동 스크립트 사용 (추천) 🚀

### 단계 1: API 키 발급

먼저 각 서비스에서 API 키를 발급받으세요:

1. **RapidAPI (AeroDataBox)**: https://rapidapi.com/aedbx-aedbx/api/aerodatabox
   - 무료 플랜: 월 150회 요청
   
2. **인천공항 API**: https://www.airport.kr/ap_cnt/ko/svc/selectSvcOpenApiGuideList.do
   - 무료, 회원가입 후 발급

3. **Exchange Rate API**: https://www.exchangerate-api.com/
   - 무료 플랜: 월 1,500회 요청

4. **CheckWX** (선택): https://www.checkwxapi.com/
   - 무료 플랜: 하루 1,000회 요청

5. **OpenWeatherMap** (선택): https://openweathermap.org/api
   - 무료 플랜: 분당 60회 요청

6. **AQICN** (선택): https://aqicn.org/api/
   - 무료 플랜 제공

### 단계 2: 스크립트 실행

터미널에서 다음 명령어를 실행하세요:

```bash
# 프로젝트 디렉토리로 이동
cd /Users/antoniolim/Documents/자작앱/flightdashboard1

# 스크립트 실행
./setup-vercel-env.sh
```

스크립트가 각 API 키를 입력받아 자동으로 Vercel에 설정합니다.

### 단계 3: 재배포

```bash
# Vercel에 재배포
vercel --prod
```

---

## 방법 2: Vercel 대시보드 (수동)

### 단계 1: Vercel 대시보드 접속

1. https://vercel.com/dashboard 접속
2. 프로젝트 선택 (mykneeboard)
3. **Settings** 탭 클릭
4. 왼쪽 메뉴에서 **Environment Variables** 클릭

### 단계 2: 환경변수 추가

각 환경변수를 하나씩 추가합니다:

1. **Name** 필드에 환경변수 이름 입력 (예: `RAPIDAPI_KEY`)
2. **Value** 필드에 API 키 입력
3. 체크박스에서 **Production**, **Preview**, **Development** 모두 선택
4. **Save** 버튼 클릭
5. 다음 환경변수로 반복

### 단계 3: 재배포

1. **Deployments** 탭으로 이동
2. 최신 배포 찾기
3. **···** (더보기) 메뉴 클릭
4. **Redeploy** 선택
5. **Redeploy** 버튼 클릭 (Use existing Build Cache 체크 해제 권장)

---

## 방법 3: Vercel CLI (수동)

Vercel CLI로 하나씩 수동으로 설정할 수도 있습니다:

```bash
# Vercel CLI 설치 (없는 경우)
npm install -g vercel

# Vercel 로그인
vercel login

# 프로젝트 디렉토리로 이동
cd /Users/antoniolim/Documents/자작앱/flightdashboard1

# 환경변수 추가 (각각 실행)
vercel env add RAPIDAPI_KEY production
vercel env add RAPIDAPI_KEY preview
vercel env add RAPIDAPI_KEY development

vercel env add INCHEON_API_KEY production
vercel env add INCHEON_API_KEY preview
vercel env add INCHEON_API_KEY development

vercel env add EXCHANGE_API_KEY production
vercel env add EXCHANGE_API_KEY preview
vercel env add EXCHANGE_API_KEY development

# 나머지 환경변수도 동일하게 추가...

# 재배포
vercel --prod
```

---

## ✅ 설정 확인

### 1. 환경변수 확인

```bash
# Vercel CLI로 확인
vercel env ls
```

### 2. API 작동 테스트

브라우저나 curl로 API 엔드포인트를 테스트하세요:

```bash
# AeroDataBox API 테스트
curl "https://mykneeboard.vercel.app/api/aerodatabox-search" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"flightNumber":"KE001","date":"2025-01-15"}'

# 환율 API 테스트
curl "https://mykneeboard.vercel.app/api/exchange?fromCurrency=USD&toCurrency=KRW"

# 인천공항 API 테스트
curl "https://mykneeboard.vercel.app/api/incheon/flights" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"flightNumber":"KE001","searchType":"both"}'
```

### 3. 브라우저 콘솔 확인

1. https://mykneeboard.vercel.app 접속
2. F12 → Console 탭
3. 항공편 검색 시도
4. 다음 메시지가 보이면 성공:
   ```
   ✅ AeroDataBox API 검색 성공: N개
   ```

---

## 🔧 트러블슈팅

### "❌ RAPIDAPI_KEY 환경변수가 설정되지 않았습니다"

**원인**: 환경변수가 Vercel에 설정되지 않음

**해결**:
1. Vercel 대시보드에서 환경변수 확인
2. 환경변수 추가 후 **반드시 Redeploy**

### "500 Internal Server Error"

**원인**: API 키가 잘못되었거나 만료됨

**해결**:
1. 각 API 서비스에서 키가 유효한지 확인
2. 필요시 새 키 발급
3. Vercel 환경변수 업데이트
4. Redeploy

### 환경변수가 적용되지 않음

**원인**: 재배포를 하지 않음

**해결**:
```bash
# Vercel에서 환경변수 변경 후 반드시 재배포
vercel --prod
```

---

## 📚 참고 자료

- [Vercel 환경변수 가이드](https://vercel.com/docs/concepts/projects/environment-variables)
- [Vercel CLI 문서](https://vercel.com/docs/cli)
- [프로젝트 보안 정책](./SECURITY.md)

---

## 💡 팁

1. **API 키 관리**: 1Password, LastPass 등 비밀번호 관리 도구 사용 권장
2. **정기 로테이션**: 3-6개월마다 API 키 갱신 권장
3. **무료 플랜 제한**: 각 API의 무료 플랜 제한 확인
4. **모니터링**: Vercel 대시보드에서 API 호출 로그 확인

