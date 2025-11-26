# Firebase 항공편 데이터 업로드 가이드

이 가이드는 Firebase Console을 통해 항공편 스케줄 데이터를 업로드하는 방법을 설명합니다.

## 📋 데이터 형식

### 축약된 JSON 형식 (그대로 업로드)

```json
{
  "fs": {
    "a": {
      "OZ": {
        "OZ101": {"dep": "NRT", "arr": "ICN"},
        "OZ102": {"dep": "ICN", "arr": "NRT"},
        "OZ201": {"dep": "LAX", "arr": "ICN"},
        "OZ202": {"dep": "ICN", "arr": "LAX"}
      },
      "KE": {
        "KE001": {"dep": "ICN", "arr": "JFK"},
        "KE002": {"dep": "JFK", "arr": "ICN"}
      },
      "7C": {
        "7C1401": {"dep": "ICN", "arr": "FUK"},
        "7C1402": {"dep": "FUK", "arr": "ICN"}
      }
    },
    "m": {
      "s": "2025-01-18T17:46:00.000Z",
      "t": 450,
      "v": "2.1"
    }
  }
}
```

### 데이터 구조 설명

- `fs`: Flight Schedules (항공편 스케줄)
- `fs/a`: Airlines (항공사별 데이터)
- `fs/a/{airlineCode}`: 항공사 코드 (예: OZ, KE, 7C)
- `fs/a/{airlineCode}/{flightNumber}`: 항공편 번호
  - `dep`: Departure (출발지 IATA 코드)
  - `arr`: Arrival (도착지 IATA 코드)
- `fs/m`: Metadata (메타데이터)
  - `s`: Sync time (동기화 시간)
  - `t`: Total flights (전체 항공편 수)
  - `v`: Version (데이터 버전)

## 📤 Firebase Console 업로드 방법

### 1단계: Firebase Console 접속

1. https://console.firebase.google.com/ 접속
2. 프로젝트 선택 (flightdashboard1)
3. 왼쪽 메뉴에서 **"Realtime Database"** 클릭

### 2단계: JSON 데이터 가져오기

1. Realtime Database 화면 우측 상단 **⋮** (점 3개) 클릭
2. **"JSON 가져오기"** 선택
3. 두 가지 방법 중 선택:
   - **파일 선택**: 준비한 JSON 파일 업로드
   - **JSON 붙여넣기**: JSON 텍스트 직접 붙여넣기
4. **"가져오기"** 버튼 클릭

### 3단계: 데이터 확인

업로드 후 Firebase Console에서 다음 구조를 확인:

```
firebase-database/
├── fs/
│   ├── a/
│   │   ├── OZ/
│   │   │   ├── OZ101/
│   │   │   │   ├── dep: "NRT"
│   │   │   │   └── arr: "ICN"
│   │   │   ├── OZ102/
│   │   │   └── ...
│   │   ├── KE/
│   │   └── 7C/
│   └── m/
│       ├── s: "2025-01-18T17:46:00.000Z"
│       ├── t: 450
│       └── v: "2.1"
└── admins/
    └── {YOUR_UID}: true
```

## 🔐 관리자 계정 등록 (최초 1회)

### 방법 1: Firebase Console에서 직접 등록

1. Firebase Console → Realtime Database
2. 루트 노드에서 **"+"** 버튼 클릭
3. 이름: `admins`, 클릭하여 생성
4. `admins` 노드 아래에 **"+"** 버튼 클릭
5. 이름: `{YOUR_USER_UID}` (사용자 UID)
6. 값: `true`
7. **"추가"** 버튼 클릭

### UID 확인 방법

**방법 1: Firebase Console**
1. Firebase Console → Authentication → Users 탭
2. 사용자 목록에서 UID 복사

**방법 2: 앱에서 확인**
1. 앱에 로그인
2. 브라우저 개발자 도구 (F12) → Console 탭
3. 다음 코드 입력: `console.log(user.uid)`
4. 출력된 UID 복사

### 예시

```
admins/
  abc123xyz456: true
  def789uvw012: true
```

## 🔄 데이터 업데이트 절차

### 전체 데이터 업데이트

1. 새로운 JSON 파일 준비 (모든 항공편 포함)
2. Firebase Console → Realtime Database
3. `fs` 노드 선택
4. 우측 상단 **⋮** → **"JSON 가져오기"**
5. **"기존 데이터 덮어쓰기"** 옵션 확인
6. JSON 파일 업로드

### 특정 항공사 데이터만 업데이트

1. Firebase Console → Realtime Database
2. `fs/a/{airlineCode}` 노드 선택 (예: `fs/a/OZ`)
3. 우측 상단 **⋮** → **"JSON 가져오기"**
4. 해당 항공사의 JSON만 업로드

예시 (OZ만 업데이트):
```json
{
  "OZ101": {"dep": "NRT", "arr": "ICN"},
  "OZ102": {"dep": "ICN", "arr": "NRT"}
}
```

### 특정 항공편만 수정

1. Firebase Console → Realtime Database
2. `fs/a/{airlineCode}/{flightNumber}` 노드 선택
3. 직접 값 수정 (dep, arr)
4. **Enter** 키로 저장

## ⚡ 앱에서 데이터 확인

데이터 업로드 후:

1. 앱을 새로고침하거나 재시작
2. 항공편 검색 기능 사용
3. Firebase DB에서 데이터 자동 로드
4. IndexedDB에 자동 캐싱 (오프라인 사용 가능)

### 검색 우선순위

1. **AeroDataBox API** (실시간 데이터)
2. **인천공항 API** (백업)
3. **Firebase 공유 DB** (최종 백업, 오프라인 지원)

### 오프라인 모드

- Firebase에서 한 번 로드된 데이터는 IndexedDB에 캐싱
- 오프라인에서도 7일간 사용 가능
- 7일 후 자동 삭제

## 🚨 주의사항

1. **데이터 형식 검증**: JSON 형식이 올바른지 확인
2. **IATA 코드 사용**: dep, arr에 3글자 IATA 코드 사용 (예: ICN, NRT)
3. **대문자 사용**: 모든 항공편 번호와 공항 코드는 대문자
4. **메타데이터 업데이트**: 데이터 변경 시 `fs/m` 의 sync time 업데이트
5. **백업**: 업데이트 전 기존 데이터 Export하여 백업

## 📊 데이터 Export (백업)

1. Firebase Console → Realtime Database
2. `fs` 노드 선택
3. 우측 상단 **⋮** → **"JSON 내보내기"**
4. 파일 저장

## 🔧 문제 해결

### 데이터가 앱에 표시되지 않음

1. Firebase Console에서 데이터 구조 확인
2. Database Rules가 올바른지 확인 (`.read: "auth != null"`)
3. 앱 새로고침 (캐시 초기화)
4. 브라우저 개발자 도구 → Console 탭에서 오류 확인

### 권한 오류 (Permission Denied)

1. Database Rules 확인
2. 사용자가 로그인되어 있는지 확인
3. `admins` 노드에 UID가 올바르게 등록되었는지 확인

### 검색 결과가 나오지 않음

1. 항공편 번호가 올바른지 확인 (대문자, 숫자)
2. Firebase Console에서 해당 항공편이 존재하는지 확인
3. IndexedDB 캐시 삭제 후 재시도 (개발자 도구 → Application → IndexedDB)

## 📞 문의

문제가 지속되면 개발자 도구(F12) → Console 탭의 오류 메시지를 확인하세요.

