import React, { useState, useEffect, useRef, useCallback, useMemo, useTransition, Suspense, lazy } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { useFlights, useAddFlight, useUpdateFlight, useDeleteFlight, flightKeys } from './src/hooks/useFlights';
import RestCalculator from './components/RestCalculator';
import { Flight, CurrencyInfo, CurrencyModalData, MonthlyModalData, FlightStatus } from './types';
import { getTodayString } from './constants';
import { calculateCurrency, findLastAndNextFlights, isActualFlight, mergeFlightDataWithStatusPreservation, replaceMonthDataWithStatusPreservation } from './utils/helpers';
import { toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';
import pkg from './package.json';
import { UploadCloudIcon, CalendarIcon, AirlineLogo, SettingsIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon, RefreshCwIcon, SearchIcon } from './components/icons';
import FlightCard from './components/FlightCard';
import CurrencyCard from './components/CurrencyCard';
import BlockTimeCard from './components/BlockTimeCard';
const FlightDetailModal = lazy(() => import('./components/modals/FlightDetailModal'));
const CurrencyDetailModal = lazy(() => import('./components/modals/CurrencyDetailModal'));
const MonthlyScheduleModal = lazy(() => import('./components/modals/MonthlyScheduleModal'));
const CalendarModal = lazy(() => import('./components/modals/CalendarModal'));
const ConflictResolutionModal = lazy(() => import('./components/modals/ConflictResolutionModal'));
const AnnualBlockTimeModal = lazy(() => import('./components/modals/AnnualBlockTimeModal'));
import { getAllFlights, addFlight, updateFlight, deleteFlight, subscribeToAllFlights, getUserSettings, saveUserSettings, saveDocumentExpiryDates, getDocumentExpiryDates, saveCrewMemos, getCrewMemos, saveCityMemos, getCityMemos, setFirebaseOfflineMode, syncAlarmIndexes, subscribeFriendRequests } from './src/firebase/database';
import { cacheAllFlightsFromFirebase } from './src/firebase/flightSchedules';
import { clearKeyCache } from './utils/encryption';
import { auth, database } from './src/firebase/config';
import { requestFcmToken } from './src/firebase/fcm';
import { loginUser, logoutUser, registerUser, onAuthStateChange, getCurrentUser, resetPassword, getUserInfo } from './src/firebase/auth';

// 앱 초기화 로그
console.log('🚀 App.tsx 로드됨');
console.log('🚀 Firebase auth 객체:', auth);
console.log('🚀 환경변수 확인:', {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY ? '설정됨' : '없음',
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? '설정됨' : '없음',
  VITE_FIREBASE_DATABASE_URL: import.meta.env.VITE_FIREBASE_DATABASE_URL ? '설정됨' : '없음',
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID ? '설정됨' : '없음'
});
import { createSessionTimeout } from './utils/securityUtils';
// parseExcelFile, parsePDFFile는 사용 시점에 dynamic import로 로드
import { simpleCache } from './utils/simpleCache';
import { indexedDBCache } from './utils/indexedDBCache';
import { separatedCache } from './utils/separatedCache';
import { cacheManager } from './utils/cacheManager';
import { syncStrategy } from './utils/syncStrategy';
import { ConflictInfo } from './utils/conflictResolver';

import { worldAirlines, getAirlineByICAO } from './data/worldAirlines';
// Lazy loading for modal components to improve initial bundle size
const LoginModal = lazy(() => import('./components/LoginModal'));
const RegisterModal = lazy(() => import('./components/RegisterModal'));
const NoFlightModal = lazy(() => import('./components/modals/NoFlightModal'));
const UserSettingsModal = lazy(() => import('./components/UserSettingsModal'));
const CrewHistoryModal = lazy(() => import('./components/modals/CrewHistoryModal'));
const CityScheduleModal = lazy(() => import('./components/modals/CityScheduleModal'));
const AboutModal = lazy(() => import('./components/modals/AboutModal'));
const CrewMemoModal = lazy(() => import('./components/modals/CrewMemoModal'));
const CityMemoModal = lazy(() => import('./components/modals/CityMemoModal'));
const CurrencySettingsModal = lazy(() => import('./components/modals/CurrencySettingsModal'));
const PassportVisaWarningModal = lazy(() => import('./components/modals/PassportVisaWarningModal'));
const ExpiryDateModal = lazy(() => import('./components/modals/ExpiryDateModal'));
const DeleteDataModal = lazy(() => import('./components/modals/DeleteDataModal'));
const SearchModal = lazy(() => import('./components/modals/SearchModal'));
const FriendsTab = lazy(() => import('./components/FriendsTab'));
const KakaoCallback = lazy(() => import('./components/KakaoCallback'));


import { fetchAirlineData, fetchAirlineDataWithInfo, searchAirline, getAirlineByCode, AirlineInfo, AirlineDataInfo, convertFlightNumberToIATA } from './utils/airlineData';
import { getCityInfo, getFlightTime } from './utils/cityData';
import { calculateWarnings, dismissWarningForWeek, isWarningDismissed, getSamplePassportVisaData, WarningData } from './utils/passportVisaWarning';

// Service Worker 관련 import
import { registerServiceWorker, onOnlineStatusChange, getServiceWorkerManager } from './utils/serviceWorker';

// IATA/ICAO 코드를 정규화하는 함수 (IATA -> ICAO 변환)
const getICAOCode = (airlineCode: string): string => {
  // 이미 ICAO 코드인지 확인 (3글자)
  if (airlineCode && airlineCode.length === 3) {
    return airlineCode;
  }

  // IATA 코드로 항공사 정보 찾기 (worldAirlines 데이터 사용)
  const airline = worldAirlines.find(a => a.iata === airlineCode);
  return airline?.icao || airlineCode;
};

// 항공사명을 가져오는 함수
const getAirlineName = (iataCode: string): string => {
  const airline = worldAirlines.find(a => a.iata === iataCode);
  return airline?.koreanName || iataCode;
};

// 기종명을 간단하게 변환하는 함수 (Airbus -> A, Boeing -> B)
const simplifyAircraftType = (aircraftType: string): string => {
  if (!aircraftType) return '';

  // Airbus A3xx-xxx 형식을 A3xx-xxx로 변환 (예: Airbus A330-300 -> A330-300)
  const airbusWithVariantMatch = aircraftType.match(/Airbus\s*A(\d{3}[-]\d{3}(?:ER|LR|NEO|CEO)?)/i);
  if (airbusWithVariantMatch) {
    return 'A' + (airbusWithVariantMatch[1]);
  }

  // Airbus A3xx 형식을 A3xx로 변환 (variant 없는 경우)
  const airbusMatch = aircraftType.match(/Airbus\s*A(\d{3})/i);
  if (airbusMatch) {
    return 'A' + (airbusMatch[1]);
  }

  // Boeing 7xx-xxx 형식을 B7xx-xxx로 변환 (예: Boeing 777-300ER -> B777-300ER)
  const boeingWithVariantMatch = aircraftType.match(/Boeing\s*(\d{3}[-]\d{3}(?:ER|LR|X)?)/i);
  if (boeingWithVariantMatch) {
    return 'B' + (boeingWithVariantMatch[1]);
  }

  // Boeing 7xx 형식을 B7xx로 변환 (variant 없는 경우)
  const boeingMatch = aircraftType.match(/Boeing\s*(\d{3})/i);
  if (boeingMatch) {
    return 'B' + (boeingMatch[1]);
  }

  // 이미 간단한 형식인 경우 (A320-200, B777-300ER 등)
  if (/^[AB]\d{3}/.test(aircraftType)) {
    return aircraftType;
  }

  // 기타 기종 (예: E190, CRJ900 등)
  return aircraftType;
};

// 네트워크 상태 확인 함수 (CSP 호환 버전)
const checkNetworkStatus = async (): Promise<boolean> => {
  try {
    // 1단계: navigator.onLine으로 기본적인 온라인 상태 확인
    if (!navigator.onLine) {
      return false;
    }

    // 2단계: 간단한 네트워크 연결 테스트 (CSP 호환)
    try {
      // Google의 간단한 엔드포인트 사용 (CSP에서 허용됨)
      const response = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        signal: AbortSignal.timeout(3000)
      });
      // no-cors 요청은 opaque로 돌아오므로 도달만 해도 성공으로 간주
      return true;
    } catch (error) {
      // 네트워크 테스트 실패 시 navigator.onLine을 신뢰
      return navigator.onLine;
    }
  } catch (error) {
    return navigator.onLine;
  }
};

// --- 긴급 데이터 복구용 글로벌 함수 (임시) ---
(window as any).runRecovery = async (oldUid: string) => {
  console.log('🔄 긴급 복구를 시작합니다... 대상 oldUid:', oldUid);
  try {
    const { ref, get, set } = await import('firebase/database');
    const { database } = await import('./src/firebase/config');
    const { decryptData, encryptData, decryptDataLegacy } = await import('./utils/encryption');

    const newUid = 'kakao:4768929779';

    // 1. Firebase 서버 데이터 복구 (경로 및 로직 강화)
    const serverPaths = [
      // 신규 계정 경로 (재암호화용)
      `users/${newUid}/documentExpiryDates`,
      `users/${newUid}/settings`,
      `users/${newUid}/crewMemos`,
      `users/${newUid}/cityMemos`,
      // 구 계정 경로 (데이터 마이그레이션용)
      `users/${oldUid}/documentExpiryDates`,
      `users/${oldUid}/settings`,
      `users/${oldUid}/crewMemos`,
      `users/${oldUid}/cityMemos`,
      `memos/${oldUid}`,
      `cityMemos/${oldUid}`
    ];

    let serverUpdated = 0;

    for (const path of serverPaths) {
      console.log(`\n📡 [서버] 탐색 중: ${path}...`);
      const snapshot = await get(ref(database, path));
      if (!snapshot.exists()) continue;

      const data = snapshot.val();
      if (!data || typeof data !== 'object') continue;

      const updatedData: any = { ...data };
      let pathChanged = false;

      // 헬퍼: 값 하나를 복구 시도
      const tryRecoverValue = async (val: any) => {
        if (typeof val !== 'string' || val.length < 5) return null;

        // 1. 새 키로 열리는지 확인
        try { if (await decryptData(val, newUid)) return null; } catch (e) { }

        // 2. 구 키로 시도
        try {
          const dec = await decryptData(val, oldUid);
          if (dec) return await encryptData(dec, newUid);
        } catch (e) { }

        // 3. 레거시 시도
        try {
          const dec = decryptDataLegacy(val);
          if (dec && dec !== val) return await encryptData(dec, newUid);
        } catch (e) { }

        return null;
      };

      // 루프: 데이터 구조 순회 (1단계 깊이)
      for (const [key, value] of Object.entries(data)) {
        // 값이 문자열인 경우
        const recovered = await tryRecoverValue(value);
        if (recovered) {
          updatedData[key] = recovered;
          pathChanged = true;
          serverUpdated++;
          console.log(`  ✅ [서버] 복구 성공: ${key}`);
          continue;
        }

        // 값이 객체인 경우 (documentExpiryDates 내부 등)
        if (value && typeof value === 'object') {
          for (const [subKey, subValue] of Object.entries(value)) {
            const subRecovered = await tryRecoverValue(subValue);
            if (subRecovered) {
              if (!updatedData[key]) updatedData[key] = { ...value };
              updatedData[key][subKey] = subRecovered;
              pathChanged = true;
              serverUpdated++;
              console.log(`  ✅ [서버] 심층 복구 성공: ${key}.${subKey}`);
            }
          }
        }
      }

      if (pathChanged) {
        // 결과물을 항상 신규 계정 경로(newUid)에 저장하여 마이그레이션 완결
        const targetPath = path.replace(oldUid, newUid);
        console.log(`💾 [서버] ${targetPath} 업데이트 중...`);
        await set(ref(database, targetPath), updatedData);
      }
    }

    // 2. 로컬 IndexedDB 데이터 복구
    console.log('\n📦 [로컬] IndexedDB 복구를 시도합니다...');
    let localUpdated = 0;

    const dbOpenReq = indexedDB.open('FlightDashboardDB');
    await new Promise((resolve, reject) => {
      dbOpenReq.onsuccess = async (e: any) => {
        const db = e.target.result;
        const stores = ['flights', 'crewMemos', 'cityMemos', 'documentExpiry', 'userSettings'];

        for (const storeName of stores) {
          if (!db.objectStoreNames.contains(storeName)) continue;

          try {
            // 1. 모든 항목을 먼저 읽기 (Read-only)
            const allItems: any[] = await new Promise((res, rej) => {
              const readTx = db.transaction(storeName, 'readonly');
              const store = readTx.objectStore(storeName);
              const req = store.getAll();
              req.onsuccess = () => res(req.result);
              req.onerror = () => rej(req.error);
            });

            // 2. 비동기 암호화 작업 수행 (트랜잭션 밖에서)
            const updates = [];
            for (const item of allItems) {
              let itemChanged = false;
              if (item.userId === oldUid) {
                item.userId = newUid;
                itemChanged = true;
              }

              for (const [key, val] of Object.entries(item)) {
                if (typeof val === 'string' && val.length > 20) {
                  let dec = null;
                  try { dec = await decryptData(val, oldUid); } catch (e) { }
                  if (!dec) { try { dec = decryptDataLegacy(val); } catch (e) { } }

                  if (dec) {
                    console.log(`✅ [로컬] ${storeName} 복호화 성공: [${key}]`);
                    item[key] = await encryptData(dec, newUid);
                    itemChanged = true;
                    localUpdated++;
                  }
                }
              }
              if (itemChanged) updates.push(item);
            }

            // 3. 변경사항이 있는 경우에만 새 트랜잭션으로 업데이트
            if (updates.length > 0) {
              console.log(`💾 [로컬] ${storeName} 업데이트 중 (${updates.length}건)...`);
              const writeTx = db.transaction(storeName, 'readwrite');
              const writeStore = writeTx.objectStore(storeName);
              for (const item of updates) {
                writeStore.put(item);
              }
              await new Promise((res, rej) => {
                writeTx.oncomplete = () => res(null);
                writeTx.onerror = () => rej(writeTx.error);
              });
            }
          } catch (err) {
            console.error(`❌ [로컬] ${storeName} 복구 중 오류:`, err);
          }
        }
        resolve(null);
      };
      dbOpenReq.onerror = () => reject(dbOpenReq.error);
    });

    console.log(`\n🎉 모든 복구 작업 완료!`);
    console.log(`- 서버 데이터 갱신: ${serverUpdated}건`);
    console.log(`- 로컬 캐시 갱신: ${localUpdated}건`);
    console.log('브라우저를 새로고침하여 메모와 여권 정보를 확인하세요.');
  } catch (error) {
    console.error('복구 중 오류 발생:', error);
  }
};

// 새로고침 실행 (온라인 시 최신 버전 확인 후만 리로드)


// 국기 아이콘을 가져오는 함수
const getCountryFlag = (country: string | null): string => {
  if (!country) return '🏳️';

  const flagMap: { [key: string]: string } = {
    // 한글 국가명
    '대한민국': '🇰🇷',
    '일본': '🇯🇵',
    '중국': '🇨🇳',
    '미국': '🇺🇸',
    '영국': '🇬🇧',
    '독일': '🇩🇪',
    '프랑스': '🇫🇷',
    '이탈리아': '🇮🇹',
    '스페인': '🇪🇸',
    '네덜란드': '🇳🇱',
    '스위스': '🇨🇭',
    '오스트리아': '🇦🇹',
    '벨기에': '🇧🇪',
    '덴마크': '🇩🇰',
    '스웨덴': '🇸🇪',
    '노르웨이': '🇳🇴',
    '핀란드': '🇫🇮',
    '아일랜드': '🇮🇪',
    '포르투갈': '🇵🇹',
    '그리스': '🇬🇷',
    '터키': '🇹🇷',
    '폴란드': '🇵🇱',
    '헝가리': '🇭🇺',
    '불가리아': '🇧🇬',
    '루마니아': '🇷🇴',
    '크로아티아': '🇭🇷',
    '슬로베니아': '🇸🇮',
    '러시아': '🇷🇺',
    '홍콩': '🇭🇰',
    '태국': '🇹🇭',
    '대만': '🇹🇼',
    '싱가포르': '🇸🇬',
    '인도네시아': '🇮🇩',
    '베트남': '🇻🇳',
    '호주': '🇦🇺',
    '뉴질랜드': '🇳🇿',
    '체코': '🇨🇿',
    '미얀마': '🇲🇲',
    '필리핀': '🇵🇭',
    '말레이시아': '🇲🇾',
    '인도': '🇮🇳',
    '브라질': '🇧🇷',
    '캐나다': '🇨🇦',
    '멕시코': '🇲🇽',
    '아르헨티나': '🇦🇷',
    '칠레': '🇨🇱',
    '콜롬비아': '🇨🇴',
    '페루': '🇵🇪',
    '이집트': '🇪🇬',
    '남아프리카': '🇿🇦',
    '모로코': '🇲🇦',
    '튀니지': '🇹🇳',
    '케냐': '🇰🇪',
    '나이지리아': '🇳🇬',
    '이스라엘': '🇮🇱',
    '사우디아라비아': '🇸🇦',
    '아랍에미리트': '🇦🇪',
    '카타르': '🇶🇦',
    '쿠웨이트': '🇰🇼',
    '바레인': '🇧🇭',
    '오만': '🇴🇲',
    '요르단': '🇯🇴',
    '레바논': '🇱🇧',
    '시리아': '🇸🇾',
    '이라크': '🇮🇶',
    '이란': '🇮🇷',
    '아프가니스탄': '🇦🇫',
    '파키스탄': '🇵🇰',
    '방글라데시': '🇧🇩',
    '스리랑카': '🇱🇰',
    '몰디브': '🇲🇻',
    '네팔': '🇳🇵',
    '부탄': '🇧🇹',
    '몽골': '🇲🇳',
    '북한': '🇰🇵',
    '라오스': '🇱🇦',
    '캄보디아': '🇰🇭',
    '브루나이': '🇧🇳',
    '동티모르': '🇹🇱',
    '키프로스': '🇨🇾',
    '몰타': '🇲🇹',
    '아이슬란드': '🇮🇸',
    '리히텐슈타인': '🇱🇮',
    '모나코': '🇲🇨',
    '산마리노': '🇸🇲',
    '바티칸': '🇻🇦',
    '안도라': '🇦🇩',
    '룩셈부르크': '🇱🇺',
    '에스토니아': '🇪🇪',
    '라트비아': '🇱🇻',
    '리투아니아': '🇱🇹',
    '우크라이나': '🇺🇦',
    '벨라루스': '🇧🇾',
    '몰도바': '🇲🇩',
    '알바니아': '🇦🇱',
    '보스니아헤르체고비나': '🇧🇦',
    '세르비아': '🇷🇸',
    '몬테네그로': '🇲🇪',
    '북마케도니아': '🇲🇰',
    '코소보': '🇽🇰',
    '조지아': '🇬🇪',
    '아르메니아': '🇦🇲',
    '아제르바이잔': '🇦🇿',
    '카자흐스탄': '🇰🇿',
    '우즈베키스탄': '🇺🇿',
    // 영어 국가명 (기존)
    'South Korea': '🇰🇷',
    'United States': '🇺🇸',
    'United Kingdom': '🇬🇧',
    'Netherlands': '🇳🇱',
    'Spain': '🇪🇸',
    'France': '🇫🇷',
    'Italy': '🇮🇹',
    'Germany': '🇩🇪',
    'Czech Republic': '🇨🇿',
    'Switzerland': '🇨🇭',
    'Austria': '🇦🇹',
    'Belgium': '🇧🇪',
    'Denmark': '🇩🇰',
    'Sweden': '🇸🇪',
    'Norway': '🇳🇴',
    'Finland': '🇫🇮',
    'Ireland': '🇮🇪',
    'Portugal': '🇵🇹',
    'Greece': '🇬🇷',
    'Turkey': '🇹🇷',
    'Poland': '🇵🇱',
    'Hungary': '🇭🇺',
    'Bulgaria': '🇧🇬',
    'Romania': '🇷🇴',
    'Croatia': '🇭🇷',
    'Slovenia': '🇸🇮',
    'Russia': '🇷🇺',
    'Japan': '🇯🇵',
    'Hong Kong': '🇭🇰',
    'Thailand': '🇹🇭',
    'China': '🇨🇳',
    'Taiwan': '🇹🇼',
    'Singapore': '🇸🇬',
    'Indonesia': '🇮🇩',
    'Vietnam': '🇻🇳',
    'Australia': '🇦🇺',
    'New Zealand': '🇳🇿'
  };

  return flagMap[country] || '🏳️';
};

const DISPLAY_VERSION = pkg.version;

const App: React.FC = () => {
  // React 18 Concurrent Features
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();


  // 상태 관리
  const [user, setUser] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<{ displayName: string | null; empl?: string; userName?: string; company?: string } | null>(null);

  // TanStack  // 항공편 데이터 가져오기
  const { data: flights = [], isLoading: isFlightsLoading, refetch: refetchFlights } = useFlights(user?.uid);



  const addFlightMutation = useAddFlight();
  const updateFlightMutation = useUpdateFlight();
  const deleteFlightMutation = useDeleteFlight();

  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ pendingCount: 0, isSyncing: false });
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [selectedFlightType, setSelectedFlightType] = useState<'last' | 'next' | 'nextNext' | undefined>(undefined);
  const [currencyModalData, setCurrencyModalData] = useState<CurrencyModalData | null>(null);
  const [monthlyModalData, setMonthlyModalData] = useState<MonthlyModalData | null>(null);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1); // 1-based
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isUserSettingsModalOpen, setIsUserSettingsModalOpen] = useState(false);

  // 친구 요청 전역 알림
  const [friendRequestAlert, setFriendRequestAlert] = useState<{ name: string; id: string } | null>(null);
  const friendRequestCountRef = React.useRef<number>(-1); // -1 = 아직 초기화 안됨

  // 카카오 전환 권유 팝업
  const [showKakaoSwitchPopup, setShowKakaoSwitchPopup] = useState(false);
  const [selectedAirline, setSelectedAirline] = useState('OZ');
  const [baseIata, setBaseIata] = useState<string | undefined>(() => {
    const saved = localStorage.getItem('baseIata');
    return saved || undefined;
  });
  const [isCrewHistoryModalOpen, setIsCrewHistoryModalOpen] = useState(false);
  const [selectedCrewName, setSelectedCrewName] = useState<string>('');
  const [flightsWithSelectedCrew, setFlightsWithSelectedCrew] = useState<Flight[]>([]);
  const [selectedCrewType, setSelectedCrewType] = useState<'flight' | 'cabin'>('flight');
  const [isCrewMemoModalOpen, setIsCrewMemoModalOpen] = useState(false);
  const [crewMemos, setCrewMemos] = useState<{ [key: string]: string }>({});
  const [isCityMemoModalOpen, setIsCityMemoModalOpen] = useState(false);
  const [selectedCityForMemo, setSelectedCityForMemo] = useState<string>('');
  const [cityMemos, setCityMemos] = useState<{ [key: string]: string }>({
    'FCO': '테스트 메모: FCO 로마 공항에 대한 메모입니다.'
  });
  const [isCityScheduleModalOpen, setIsCityScheduleModalOpen] = useState(false);
  const [selectedCityForSchedule, setSelectedCityForSchedule] = useState<string>('');
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isCurrencyExpanded, setIsCurrencyExpanded] = useState(() => {
    // 저장소 손실 시에도 기본 상태 유지 (접힌 상태)
    const saved = localStorage.getItem('isCurrencyExpanded');
    return saved ? JSON.parse(saved) : false; // 기본값을 false로 설정 (접힌 상태)
  });
  const [isRestExpanded, setIsRestExpanded] = useState(() => {
    const saved = localStorage.getItem('isRestExpanded');
    return saved ? JSON.parse(saved) : true;
  });
  const [isFlightDataExpanded, setIsFlightDataExpanded] = useState(() => {
    const saved = localStorage.getItem('isFlightDataExpanded');
    return saved ? JSON.parse(saved) : true;
  });
  const [isIosStandalone, setIsIosStandalone] = useState(false);
  const [isCurrencySettingsModalOpen, setIsCurrencySettingsModalOpen] = useState(false);
  const [selectedCurrencyCards, setSelectedCurrencyCards] = useState<string[]>(() => {
    // 저장소 손실 시에도 모든 카드가 표시되도록 설정
    const saved = localStorage.getItem('selectedCurrencyCards');
    return saved ? JSON.parse(saved) : ['passport', 'visa', 'epta', 'radio', 'whitecard', 'crm']; // Yellow Card를 CRM으로 변경
  });



  // 오프라인 모드에서 UI 상태 강제 복원
  useEffect(() => {
    if (isOffline) {
      console.log('🔧 오프라인 모드 UI 상태 복원 시작...');

      // 오프라인 모드에서 UI 상태가 깨지지 않도록 강제 설정
      const savedCurrencyExpanded = localStorage.getItem('isCurrencyExpanded');
      if (savedCurrencyExpanded) {
        setIsCurrencyExpanded(JSON.parse(savedCurrencyExpanded));
        console.log('✅ Currency UI 상태 복원:', JSON.parse(savedCurrencyExpanded));
      }

      const savedCurrencyCards = localStorage.getItem('selectedCurrencyCards');
      if (savedCurrencyCards) {
        setSelectedCurrencyCards(JSON.parse(savedCurrencyCards));
        console.log('✅ CurrencyCards UI 상태 복원');
      }

      const savedActiveTab = localStorage.getItem('activeTab');
      if (savedActiveTab && ['dashboard', 'rest', 'flightData'].includes(savedActiveTab)) {
        setActiveTab(savedActiveTab as 'dashboard' | 'rest' | 'flightData');
        console.log('✅ ActiveTab UI 상태 복원:', savedActiveTab);
      }

      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        setTheme(savedTheme as 'light' | 'dark');
        console.log('✅ Theme UI 상태 복원:', savedTheme);
      }

      // 추가 UI 상태 복원
      const savedRestExpanded = localStorage.getItem('isRestExpanded');
      if (savedRestExpanded) {
        setIsRestExpanded(JSON.parse(savedRestExpanded));
        console.log('✅ Rest UI 상태 복원:', JSON.parse(savedRestExpanded));
      }

      const savedFlightDataExpanded = localStorage.getItem('isFlightDataExpanded');
      if (savedFlightDataExpanded) {
        setIsFlightDataExpanded(JSON.parse(savedFlightDataExpanded));
        console.log('✅ FlightData UI 상태 복원:', JSON.parse(savedFlightDataExpanded));
      }

      // BASE 정보 복원 (오프라인에서 ICN 표시 방지)
      const savedBaseIata = localStorage.getItem('baseIata');
      if (savedBaseIata && !baseIata) {
        setBaseIata(savedBaseIata);
        console.log('✅ BASE 정보 복원:', savedBaseIata);
      }

      // 로딩 상태 강제 해제 (오프라인에서 무한 로딩 방지)
      if (isLoading) {
        setTimeout(() => {
          setIsLoading(false);
          console.log('✅ 오프라인 모드에서 로딩 상태 강제 해제');
        }, 1000);
      }

      console.log('🔧 오프라인 모드 UI 상태 복원 완료');
    }
  }, [isOffline, isLoading]);
  const [noFlightModal, setNoFlightModal] = useState<{ isOpen: boolean; type?: 'last' | 'next' | 'nextNext' }>({ isOpen: false });
  const [isPassportVisaWarningOpen, setIsPassportVisaWarningOpen] = useState(false);
  const [passportVisaWarnings, setPassportVisaWarnings] = useState<WarningData[]>([]);
  const [isExpiryDateModalOpen, setIsExpiryDateModalOpen] = useState(false);
  const [selectedCardForExpiry, setSelectedCardForExpiry] = useState<{ type: string, name: string } | null>(null);
  const [cardExpiryDates, setCardExpiryDates] = useState<{ [key: string]: string }>({});
  const [isAnnualBlockTimeModalOpen, setIsAnnualBlockTimeModalOpen] = useState(false);
  const [isDeleteDataModalOpen, setIsDeleteDataModalOpen] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAdminJsonUploadModalOpen, setIsAdminJsonUploadModalOpen] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState<boolean | null>(null); // null: 확인 중, true: 관리자, false: 일반 사용자
  const [refreshMessage, setRefreshMessage] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 세션 타임아웃 관리
  const [sessionTimeout, setSessionTimeout] = useState<{ resetTimeout: () => void; clearTimeout: () => void } | null>(null);

  // 주황색 단계 이하(90일 이하) 카드 확인 함수
  const hasUrgentCards = useMemo(() => {
    return selectedCurrencyCards.some(cardType => {
      const expiryDate = cardExpiryDates[cardType];
      if (!expiryDate) return false;

      const today = new Date();
      const expiry = new Date(expiryDate);
      const timeDiff = expiry.getTime() - today.getTime();
      const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));

      // White Card는 30일 이하, 다른 카드는 90일 이하
      if (cardType === 'whitecard') {
        return daysUntilExpiry <= 30;
      } else {
        return daysUntilExpiry <= 90;
      }
    });
  }, [selectedCurrencyCards, cardExpiryDates]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [theme, setTheme] = useState(() => {
    // 저장소 손실 시에도 다크 모드로 기본 설정
    const saved = localStorage.getItem('theme');
    return saved || 'dark'; // 기본값을 'dark'로 설정
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'friends' | 'rest' | 'flightData'>(() => {
    // 저장소 손실 시에도 dashboard 탭이 기본으로 표시되도록 설정
    const saved = localStorage.getItem('activeTab');
    return (saved as any) || 'dashboard';
  });
  const [friendModalData, setFriendModalData] = useState<MonthlyModalData | null>(null);
  const [friendUserInfo, setFriendUserInfo] = useState<any>(null);

  // 탭 전환 함수 (오프라인 상태에서도 정상 작동)
  const handleTabChange = useCallback((tab: 'dashboard' | 'friends' | 'rest' | 'flightData') => {
    console.log('🔄 탭 전환:', tab, '오프라인:', isOffline);
    setActiveTab(tab);

    // 오프라인 모드에서 탭 전환 시 UI 상태 강제 복원
    if (isOffline) {
      setTimeout(() => {
        console.log('🔧 오프라인 탭 전환 후 UI 상태 복원...');

        // 현재 탭에 따른 UI 상태 복원
        if (tab === 'dashboard') {
          const savedCurrencyExpanded = localStorage.getItem('isCurrencyExpanded');
          if (savedCurrencyExpanded) {
            setIsCurrencyExpanded(JSON.parse(savedCurrencyExpanded));
          }
        } else if (tab === 'rest') {
          const savedRestExpanded = localStorage.getItem('isRestExpanded');
          if (savedRestExpanded) {
            setIsRestExpanded(JSON.parse(savedRestExpanded));
          }
        } else if (tab === 'flightData') {
          const savedFlightDataExpanded = localStorage.getItem('isFlightDataExpanded');
          if (savedFlightDataExpanded) {
            setIsFlightDataExpanded(JSON.parse(savedFlightDataExpanded));
          }
        }
      }, 100);
    }
  }, [activeTab, isOffline]);
  const [utcTime, setUtcTime] = useState('');
  const [showFlightResults, setShowFlightResults] = useState(false);
  const [showAirlineResults, setShowAirlineResults] = useState(false);
  const [airlineData, setAirlineData] = useState<AirlineInfo[]>([]);
  const [, setAirlineDataInfo] = useState<AirlineDataInfo | null>(null);
  const [airlineSearchQuery, setAirlineSearchQuery] = useState('');
  const [airlineSearchResults, setAirlineSearchResults] = useState<AirlineInfo[]>([]);
  const [isLoadingAirlineData, setIsLoadingAirlineData] = useState(false);


  // 항공편 검색 관련 상태
  const [flightSearchQuery, setFlightSearchQuery] = useState('');
  const [flightSearchResults, setFlightSearchResults] = useState<any[]>([]);
  const [isLoadingFlightData, setIsLoadingFlightData] = useState(false);

  // 항공편 경로 추적 관련 상태


  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);



  // 현재 테마 상태 계산
  const isDarkMode = useMemo(() => {
    return true; // 테마 관리 - 항상 다크모드 강제 적용
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  }, []);

  // UI 상태 저장 (저장소 손실 방지)
  useEffect(() => {
    localStorage.setItem('isCurrencyExpanded', JSON.stringify(isCurrencyExpanded));
  }, [isCurrencyExpanded]);

  useEffect(() => {
    localStorage.setItem('selectedCurrencyCards', JSON.stringify(selectedCurrencyCards));
  }, [selectedCurrencyCards]);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // BASE 정보 저장 (오프라인 대응)
  useEffect(() => {
    if (baseIata) {
      localStorage.setItem('baseIata', baseIata);
    }
  }, [baseIata]);

  // Service Worker 등록 및 오프라인 상태 관리
  useEffect(() => {
    // 앱 시작 시 네트워크 상태 확인 (더 안정적인 방법)
    (async () => {
      // 1단계: navigator.onLine으로 기본 확인
      const basicOnline = navigator.onLine;

      if (!basicOnline) {
        // 오프라인이 확실하면 바로 설정
        setIsOffline(true);
        // setFirebaseOfflineMode(true); // 공격적인 오프라인 모드 전환 방지
        return;
      }

      // 2단계: 실제 네트워크 연결 테스트
      try {
        const online = await checkNetworkStatus();
        setIsOffline(!online);
        // setFirebaseOfflineMode(!online); // 공격적인 오프라인 모드 전환 방지
      } catch (error) {
        // 오류 시 안전하게 오프라인으로 설정
        setIsOffline(true);
        // setFirebaseOfflineMode(true); // 공격적인 오프라인 모드 전환 방지
      }
    })();
    const initializeServiceWorker = async () => {
      try {
        // Service Worker 지원 여부 확인
        if ('serviceWorker' in navigator) {
          const registered = await registerServiceWorker();
          if (registered) {
            // Service Worker 등록 완료
            // 핵심 자산 사전 캐시 (사파리 재개/비행모드 재시작 대응)
            try {
              const manager = getServiceWorkerManager();
              const urls = new Set<string>(['/', '/index.html']);
              Array.from(document.querySelectorAll('script[src]')).forEach((el: any) => {
                const src = el.getAttribute('src');
                if (src && src.startsWith('/')) urls.add(src);
              });
              Array.from(document.querySelectorAll('link[rel="stylesheet"][href]')).forEach((el: any) => {
                const href = el.getAttribute('href');
                if (href && href.startsWith('/')) urls.add(href);
              });
              Array.from(document.querySelectorAll('link[rel~="icon"][href], img[src]')).forEach((el: any) => {
                const url = el.getAttribute('href') || el.getAttribute('src');
                if (url && url.startsWith('/')) urls.add(url);
              });
              Array.from(document.querySelectorAll('link[href*="/assets/"], script[src*="/assets/"]')).forEach((el: any) => {
                const url = el.getAttribute('href') || el.getAttribute('src');
                if (url && url.startsWith('/')) urls.add(url);
              });
              manager.cacheUrls(Array.from(urls));
            } catch { }
          } else {
            console.warn('Service Worker registration failed');
          }
        } else {
          console.warn('Service Worker not supported in this browser');
        }
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    };

    initializeServiceWorker();

    // 🔄 자동 버전 업데이트: 온라인 시 서버가 더 최신이면 캐시 삭제 후 자동 새로고침
    const checkForUpdate = async () => {
      try {
        // 오프라인이면 건너뜀
        if (!navigator.onLine) {
          console.log('📴 오프라인 상태: 버전 체크 건너뜀');
          return;
        }

        // 캐시 방지를 위해 타임스탬프 추가
        const response = await fetch(`/version.json?t=${Date.now()}`);
        if (!response.ok) return;

        const data = await response.json();
        const serverVersion = data.version;
        const currentVersion = __APP_VERSION__;

        console.log(`🔍 버전 체크: 현재=${currentVersion}, 서버=${serverVersion}`);

        if (serverVersion && serverVersion !== currentVersion) {
          // 무한 새로고침 루프 방지: 이미 이 버전으로 업데이트 시도했는지 확인
          const lastAttemptedVersion = sessionStorage.getItem('auto_update_attempted');
          if (lastAttemptedVersion === serverVersion) {
            console.log('⚠️ 이미 업데이트 시도한 버전:', serverVersion);
            return;
          }

          console.log('🔄 새 버전 감지! 자동 업데이트 진행:', serverVersion);
          sessionStorage.setItem('auto_update_attempted', serverVersion);

          // 서비스 워커 캐시 삭제
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            console.log('🗑️ 캐시 삭제 완료');
          }

          // 서비스 워커 업데이트
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const reg of registrations) {
              await reg.update();
            }
          }

          // 자동 새로고침
          window.location.reload();
        } else {
          console.log('✅ 최신 버전 사용 중');
          // 최신 버전이면 업데이트 시도 기록 초기화
          sessionStorage.removeItem('auto_update_attempted');
        }
      } catch (error) {
        console.log('📴 버전 체크 실패 (오프라인 가능):', error);
      }
    };

    const handleUpdateAvailable = () => {
      checkForUpdate();
    };

    const handleVisibilityChange = () => {
      // 앱이 다시 활성화되었을 때(포그라운드 진입) 버전 체크
      if (document.visibilityState === 'visible') {
        console.log('👀 앱 활성화됨: 버전 체크 수행');
        checkForUpdate();
      }
    };
    window.addEventListener('sw-update-available', handleUpdateAvailable);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkForUpdate); // 창 포커스 시에도 체크

    // 4시간마다 주기적으로 버전 체크
    const updateCheckInterval = setInterval(() => {
      console.log('⏰ 정기 버전 체크 수행 (4시간)');
      checkForUpdate();
    }, 4 * 60 * 60 * 1000);

    // 온라인/오프라인 상태 변경 감지 (안정성 향상)
    const unsubscribe = onOnlineStatusChange((isOnline) => {
      // 네트워크 상태 변경 감지됨

      // 상태 변경을 지연시켜 빈번한 전환 방지
      const timeoutId = setTimeout(() => {
        setIsOffline(!isOnline);

        if (isOnline) {
          // 온라인 복구 시 즉시 버전 체크
          checkForUpdate();

          if (user) {
            console.log('🔄 온라인 복구: 동기화 시작');
            // 온라인으로 복구되면 동기화 시도
            handleSyncWhenOnline();
          }
        }

        // Firebase RTDB 연결 상태 동기화
        try {
          // setFirebaseOfflineMode(!isOnline); // 공격적인 오프라인 모드 전환 방지
        } catch (error) {
          console.error('❌ Firebase 오프라인 모드 설정 실패:', error);
        }
      }, 1000); // 1초 지연으로 상태 안정화

      // 기존 타이머 정리
      return () => clearTimeout(timeoutId);
    });

    return () => {
      unsubscribe();
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkForUpdate);
      clearInterval(updateCheckInterval);
    };
  }, [user]);

  // UTC 시간 업데이트 (30초 단위)
  useEffect(() => {
    const updateUtcTime = () => {
      const now = new Date();
      const utcHours = now.getUTCHours().toString().padStart(2, '0');
      const utcMinutes = now.getUTCMinutes().toString().padStart(2, '0');
      setUtcTime((utcHours) + ':' + (utcMinutes) + 'Z');
    };

    // 초기 실행
    updateUtcTime();

    // 30초마다 업데이트
    const interval = setInterval(updateUtcTime, 30000);

    return () => clearInterval(interval);
  }, []);

  // iOS PWA(홈화면 추가) 환경 감지: 안전영역 보정용 상태
  useEffect(() => {
    // iPadOS(데스크탑 모드) 대응: Macintosh이면서 터치 포인트가 있으면 iOS로 간주
    const isIPad = /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints && navigator.maxTouchPoints > 1;
    const isIOS = /iphone|ipod|ipad/i.test(navigator.userAgent) || isIPad;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isIOS && isStandalone) setIsIosStandalone(true);
  }, []);

  // Show Up 알림 관련 상태
  const [lastAlarmedFlightId, setLastAlarmedFlightId] = useState<number | null>(() => {
    const saved = localStorage.getItem('lastAlarmedFlightId');
    return saved ? Number(saved) : null;
  });

  // Show Up 알림 체크 (1분마다)
  useEffect(() => {
    const checkShowUpAlarm = () => {
      if (!('Notification' in window) || window.Notification.permission !== 'granted') return;

      const todayStr = getTodayString();
      const { nextFlight } = findLastAndNextFlights(flights, todayStr);

      if (!nextFlight || !nextFlight.showUpDateTimeUtc) return;

      // 이미 알림을 보낸 비행인지 확인
      if (lastAlarmedFlightId === nextFlight.id) return;

      try {
        // 알림 시간 계산 (Show Up - 2시간)
        const showUpTime = new Date(nextFlight.showUpDateTimeUtc);
        const alarmTime = new Date(showUpTime.getTime() - 2 * 60 * 60 * 1000); // 2시간 전
        const now = new Date();

        // 알림 조건: 현재 시간이 알림 시간 이후이고, 아직 Show Up 시간은 지나지 않았을 때
        if (now >= alarmTime && now < showUpTime) {
          // 타임존 결정 (Base 설정이 있으면 Base, 없으면 Local)
          let targetTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone; // 기본값 Local
          if (baseIata) {
            const cityInfo = getCityInfo(baseIata);
            if (cityInfo) {
              targetTimezone = cityInfo.timezone;
            }
          }

          // Show Up 시간 포맷팅 (HHmm)
          const showUpDateZoned = toZonedTime(showUpTime, targetTimezone);
          const showUpTimeStr = format(showUpDateZoned, 'HHmm');

          // ETD 시간 및 날짜 포맷팅 (HHmm, yy.MM.dd)
          let etdTimeStr = 'Unknown';
          let dateStr = format(showUpDateZoned, 'yy.MM.dd'); // 기본값은 Show Up 날짜 (백업)

          if (nextFlight.departureDateTimeUtc) {
            const depUtc = new Date(nextFlight.departureDateTimeUtc);
            const depDateZoned = toZonedTime(depUtc, targetTimezone);
            etdTimeStr = format(depDateZoned, 'HHmm');
            dateStr = format(depDateZoned, 'yy.MM.dd'); // 비행 날짜(출발일) 기준
          }

          // 알림 생성
          new window.Notification(`${dateStr} <${nextFlight.flightNumber}>`, {
            body: `SHOW UP : ${showUpTimeStr} / ETD : ${etdTimeStr}`,
            icon: '/pwa-192x192.png',
            tag: `showup-alarm-${nextFlight.id}`
          });

          // 알림 보냄 상태 저장
          setLastAlarmedFlightId(nextFlight.id);
          localStorage.setItem('lastAlarmedFlightId', String(nextFlight.id));
          console.log(`🔔 Show Up 알림 전송 완료: ${dateStr} <${nextFlight.flightNumber}>, SHOW UP : ${showUpTimeStr} / ETD : ${etdTimeStr}`);
        }
      } catch (error) {
        console.error('Show Up 알림 체크 중 오류:', error);
      }
    };

    const interval = setInterval(checkShowUpAlarm, 60 * 1000); // 1분마다 체크
    checkShowUpAlarm(); // 초기 실행

    return () => clearInterval(interval);
  }, [flights, lastAlarmedFlightId, baseIata]);

  // 캐시 상태 모니터링 (24시간마다)
  useEffect(() => {
    if (!user?.uid) return;

    const monitorCache = async () => {
      try {
        // 캐시 상태 확인
        const status = await cacheManager.getAllCacheStatus(user.uid);
      } catch (error) {
        console.error('캐시 모니터링 실패:', error);
      }
    };

    monitorCache();
    const interval = setInterval(monitorCache, 24 * 60 * 60 * 1000); // 24시간마다

    return () => clearInterval(interval);
  }, [user]);


  // 앱 시작 시 여권/비자 경고 확인
  useEffect(() => {
    // 사용자가 로그인한 후에만 경고 확인
    if (user) {
      checkPassportVisaWarnings();

      // 로그인 후 백그라운드 데이터 캐싱 (오프라인 대비)
      // 이미 캐싱되어 있거나 최근에 캐싱했다면 내부적으로 스킵됨
      setTimeout(() => {
        console.log('🚀 로그인 완료: 백그라운드 데이터 캐싱 시작');
        cacheAllFlightsFromFirebase();
      }, 5000); // 로그인 직후 부하를 줄이기 위해 5초 지연 실행
    }
  }, [user]);


  // 항공사 데이터 로드 및 만료된 항공편 캐시 정리
  useEffect(() => {
    const loadAirlineData = async () => {
      try {
        setIsLoadingAirlineData(true);
        const dataInfo = await fetchAirlineDataWithInfo();
        setAirlineData(dataInfo.airlines);
        setAirlineDataInfo(dataInfo);
      } catch (error) {
        console.error('항공사 데이터 로드 실패:', error);
      } finally {
        setIsLoadingAirlineData(false);
      }
    };

    const cleanupExpiredCache = async () => {
      try {
        await indexedDBCache.cleanupExpiredFlightSchedules();
      } catch (error) {
        console.error('캐시 정리 실패:', error);
      }
    };

    loadAirlineData();
    cleanupExpiredCache();

    // 앱 시작 시 백그라운드에서 전체 비행 데이터 캐싱 (오프라인 대비)
    // 로그인 후에만 실행되도록 변경됨 (아래 useEffect 참조)
  }, []);

  // 항공사 검색 함수
  const handleAirlineSearch = useCallback(() => {
    if (!airlineSearchQuery.trim()) {
      setAirlineSearchResults([]);
      return;
    }

    const results = searchAirline(airlineSearchQuery, airlineData);
    setAirlineSearchResults(results);
    setShowAirlineResults(true);
  }, [airlineSearchQuery, airlineData]);

  // 항공편 검색 함수 (온라인: 인천공항 API 우선 → 오프라인 DB, 오프라인: 오프라인 DB만)
  const handleFlightSearch = useCallback(async () => {
    if (!flightSearchQuery.trim()) {
      setFlightSearchResults([]);
      return;
    }

    // ICAO 코드를 IATA 코드로 변환 (AAR102 → OZ102) - v2
    const flightNum = flightSearchQuery.trim().toUpperCase();
    console.log('🔄 [시작] 항공편 변환 프로세스, 입력:', flightNum);

    // ICAO → IATA 변환 매핑 (worldAirlines 데이터 활용)
    // 3글자 코드면 ICAO일 가능성이 높음
    let searchQuery = flightNum;

    const match = flightNum.match(/^([A-Z]{3})(\d+)$/);
    if (match) {
      const [, icaoCode, number] = match;
      // worldAirlines에서 해당 ICAO 코드를 가진 항공사 찾기
      const airline = worldAirlines.find(a => a.icao === icaoCode);

      if (airline) {
        const iataCode = airline.iata;
        searchQuery = (iataCode) + (number);
        console.log('🔄 ICAO→IATA 변환:', (icaoCode) + (number), '→', searchQuery);
      }
    }

    setIsLoadingFlightData(true);
    console.log('🔍 항공편 검색 시작:', searchQuery);
    console.log('🔍 원본 입력:', flightSearchQuery.trim().toUpperCase(), '→ 최종 검색:', searchQuery);
    console.log('🌐 온라인 상태:', navigator.onLine);

    try {
      let results = [];

      if (navigator.onLine) {
        // 온라인 모드: 인천공항 API만 사용

        // 인천공항 API 검색
        console.log('📡 인천공항 API 호출...');
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        try {
          const controller = new AbortController();
          timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

          const response = await fetch('/api/incheon/flights', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              flightNumber: searchQuery,
              searchType: 'both'
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            console.log('✅ 인천공항 API 응답:', data);

            if (data.results && data.results.length > 0) {
              results = data.results;
              console.log('✅ 인천공항 API 검색 성공:', results.length, '개');

              // 백그라운드에서 전체 데이터 캐싱 시작 (오프라인 대비)
              console.log('🚀 백그라운드 캐싱 함수 호출됨');
              cacheAllFlightsFromFirebase();
            } else {
              console.log('⚠️ 인천공항 API: 검색 결과 없음');
            }
          } else {
            console.log('⚠️ 인천공항 API: HTTP 오류', response.status);
          }
        } catch (error: any) {
          if (timeoutId) clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            console.log('⏱️ 인천공항 API 타임아웃 (10초)');
          } else {
            console.log('❌ 인천공항 API 오류:', error.message);
          }
        }


      } else {
        // 오프라인 모드: Firebase 공유 DB (IndexedDB 캐시) 검색
        console.log('📴 오프라인 모드: Firebase 공유 DB (캐시) 검색');
        try {
          const { searchFlightSchedules } = await import('./src/firebase/flightSchedules');
          const firebaseResults = await searchFlightSchedules(searchQuery);

          if (firebaseResults.length > 0) {
            results = firebaseResults.map(flight => ({
              flightNumber: flight.flightNumber,
              airline: flight.airline,
              departure: flight.departure,
              arrival: flight.arrival,
              time: '',
              aircraft: '',
              status: '스케줄 정보',
              type: 'Firebase DB (캐시)'
            }));
            console.log('✅ Firebase 공유 DB (캐시) 검색 성공:', results.length, '개');
          } else {
            console.log('❌ Firebase 공유 DB 캐시에서 결과 없음');
          }
        } catch (fbError) {
          console.error('❌ Firebase 공유 DB 캐시 검색 실패:', fbError);
        }
      }

      // 결과 설정
      setFlightSearchResults(results);
      setShowFlightResults(true);

      if (results.length > 0) {
        console.log('✅ 최종 검색 결과:', results.length, '개');
      } else {
        console.log('⚠️ 검색 결과 없음');
      }

    } catch (error) {
      console.error('❌ 항공편 검색 오류:', error);
      setFlightSearchResults([]);
    } finally {
      setIsLoadingFlightData(false);
    }
  }, [flightSearchQuery]);











  // 항공편 검색 함수 (인천공항 API 우선 → 오프라인 DB)
  const handleFlightHistorySearch = useCallback(async () => {
    if (!flightSearchQuery.trim()) {
      return;
    }

    // ICAO 코드를 IATA 코드로 변환 (AAR102 → OZ102)
    let flightNum = flightSearchQuery.trim().toUpperCase();
    console.log('🔄 [시작] 항공편 변환 프로세스, 입력:', flightNum);

    // ICAO → IATA 변환 매핑
    const icaoToIataMap: { [key: string]: string } = {
      'AAR': 'OZ',  // Asiana Airlines
      'KAL': 'KE',  // Korean Air
      'JJA': '7C',  // Jeju Air
      'TWB': 'TW',  // T'way Air
      'ABL': 'BX',  // Air Busan
      'ESR': 'ZE',  // Eastar Jet
      'JNA': 'LJ',  // Jin Air
      'ASV': 'RS',  // Air Seoul
      'APZ': 'YP',  // Air Premia
      'EOK': 'RF',  // Aerokorea
      'ANA': 'NH',  // All Nippon Airways
      'JAL': 'JL',  // Japan Airlines
      'APJ': 'MM',  // Peach Aviation
    };

    // 항공편 번호에서 항공사 코드 추출 (예: AAR102 → AAR)
    const match = flightNum.match(/^([A-Z]{2,3})(\d+)$/);
    if (match) {
      const [, airlineCode, number] = match;

      // 3글자 코드면 ICAO일 가능성이 높음
      if (airlineCode.length === 3 && icaoToIataMap[airlineCode]) {
        const iataCode = icaoToIataMap[airlineCode];
        flightNum = (iataCode) + (number);
        console.log('🔄 ICAO→IATA 변환:', (airlineCode) + (number), '→', flightNum);
      }
    }

    setIsLoadingFlightData(true);
    console.log('🔍 항공편 검색 시작:', flightNum);
    console.log('🔍 원본 입력:', flightSearchQuery.trim().toUpperCase(), '→ 최종 검색:', flightNum);
    console.log('🌐 온라인 상태:', navigator.onLine);

    // 4자리 숫자인 경우 시간 검색으로 처리
    // 정규식 테스트 결과를 로그로 출력하여 디버깅
    const isTimeSearch = /^\d{4}$/.test(flightNum);
    console.log('🔍 시간 검색 모드 판별: "' + (flightNum) + '" (길이: ' + (flightNum.length) + ') -> ' + (isTimeSearch));

    // 도시 IATA 코드 검색인지 확인 (3글자 코드)
    const isCitySearch = /^[A-Z]{3}$/.test(flightNum);

    if (isTimeSearch) {
      console.log('⏰ 시간 기반 검색 감지:', flightNum);

      try {
        console.log('📡 인천공항 API 호출 (시간 검색)...');
        const response = await fetch('/api/incheon/flights', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            flightNumber: 'ALL', // 시간 검색을 위한 특수 플래그
            searchType: 'departure',
            searchTime: flightNum
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ 인천공항 API 시간 검색 응답:', data);

          if (data.results && data.results.length > 0) {
            // 시간 검색 결과 필터링 (API에서 이미 정렬되어 오지만, 한번 더 확인)
            const searchHour = parseInt(flightNum.substring(0, 2), 10);
            const searchMinute = parseInt(flightNum.substring(2, 4), 10);
            const searchTimeVal = searchHour * 60 + searchMinute;

            // 디버깅을 위한 카운터
            let debugDropCount = 0;

            const formattedFlights = data.results
              .filter((flight: any) => {
                // 공동운항(Code Share) 필터링
                // 대소문자 구분 없이 'SLAVE' 체크, remark에서 공백 제거 후 'codeshare' 포함 여부 체크
                if (flight.codeshare && String(flight.codeshare).toUpperCase() === 'SLAVE') {
                  // if (debugDropCount < 3) console.log('🚫 [' + (flight.flightNumber) + '] 필터링(Codeshare):', flight.codeshare);
                  // debugDropCount++;
                  return false;
                }

                const remark = flight.remark ? String(flight.remark).toLowerCase().replace(/\s/g, '') : '';
                if (remark.includes('codeshare')) {
                  // if (debugDropCount < 3) console.log('🚫 [' + (flight.flightNumber) + '] 필터링(Remark):', flight.remark);
                  // debugDropCount++;
                  return false;
                }

                // 시간 필터링 (±30분)
                let timeStr = '';

                // 1. rawScheduleTime (HHMM 형식, 백엔드에서 매핑해준 값)
                if (flight.rawScheduleTime && /^\d{4}$/.test(flight.rawScheduleTime)) {
                  timeStr = flight.rawScheduleTime;
                }
                // 2. scheduleTime (API 원본 필드명, 혹시 매핑 안 된 경우 대비)
                else if (flight.scheduleTime && /^\d{4}$/.test(flight.scheduleTime)) {
                  timeStr = flight.scheduleTime;
                }
                // 3. scheduledTime (다양한 형식 가능)
                else if (flight.scheduledTime) {
                  // 숫자만 추출
                  const nums = String(flight.scheduledTime).replace(/\D/g, '');
                  if (nums.length >= 12) {
                    // YYYYMMDDHHMM 형식 (12자리 이상) -> 뒤에서 4자리 추출 (HHMM)
                    // 주의: nums.substring(8, 12)는 YYYYMMDDHHMM에서 HHMM을 의미
                    timeStr = nums.substring(8, 12);
                  } else if (nums.length === 4) {
                    // HHMM 형식
                    timeStr = nums;
                  }
                }

                if (!timeStr || timeStr.length !== 4) {
                  // if (debugDropCount < 10) console.log('🚫 [' + (flight.flightNumber) + '] 시간 파싱 실패: raw=' + (flight.rawScheduleTime) + ', sch=' + (flight.scheduledTime) + ', parsed=' + (timeStr));
                  // debugDropCount++;
                  return false;
                }

                const fHour = parseInt(timeStr.substring(0, 2), 10);
                const fMinute = parseInt(timeStr.substring(2, 4), 10);
                const fTimeVal = fHour * 60 + fMinute;

                let diff = Math.abs(fTimeVal - searchTimeVal);
                if (diff > 720) diff = 1440 - diff; // 자정 처리 (예: 23:50 vs 00:10)

                const isMatch = diff <= 30;
                // if (!isMatch) {
                //    if (debugDropCount < 10) console.log('🚫 [' + (flight.flightNumber) + '] 시간 범위 초과: ' + (timeStr) + ' (차이: ' + (diff) + '분) vs 검색: ' + (flightNum));
                //    debugDropCount++;
                // }
                return isMatch;
              })
              .map((flight: any) => {
                // 시간 표시 포맷팅
                let displayTime = '';
                if (flight.rawScheduleTime && /^\d{4}$/.test(flight.rawScheduleTime)) {
                  displayTime = (flight.rawScheduleTime.substring(0, 2)) + ':' + (flight.rawScheduleTime.substring(2, 4));
                } else if (flight.scheduledTime) {
                  // YYYYMMDDHHMM 형식 처리 (12자리 숫자)
                  const timeStr = String(flight.scheduledTime);
                  if (/^\d{12}$/.test(timeStr)) {
                    displayTime = (timeStr.substring(8, 10)) + ':' + (timeStr.substring(10, 12));
                  } else {
                    displayTime = flight.scheduledTime;
                  }
                }

                return {
                  flightNumber: flight.flightNumber,
                  airline: flight.airline,
                  origin: 'ICN', // 출발은 항상 인천
                  departure: 'ICN',
                  destination: flight.arrival,
                  arrival: flight.arrival,
                  time: displayTime, // 리스트에 표시될 시간
                  scheduledTime: flight.scheduledTime,
                  rawScheduleTime: flight.rawScheduleTime,
                  status: flight.status,
                  type: '인천공항 API (시간)',
                  terminal: flight.terminal,
                  gate: flight.gate,
                  aircraft: flight.aircraft,
                  // 계획된 출발 시간 추가 (SearchModal에서 표시용)
                  planTime: displayTime
                };
              });

            console.log('✅ 시간 검색 결과:', formattedFlights.length, '개');
            setFlightSearchResults(formattedFlights);
            setShowFlightResults(true);
            setIsLoadingFlightData(false);
            return;
          } else {
            console.log('⚠️ 시간 검색 결과 없음');
            alert('"' + (flightNum) + '" 시간대(±1시간)의 인천공항 출발 항공편이 없습니다.');
            setIsLoadingFlightData(false);
            return;
          }
        } else {
          console.log('❌ API 호출 실패');
          alert('시간 검색 중 오류가 발생했습니다.');
          setIsLoadingFlightData(false);
          return;
        }
      } catch (error) {
        console.error('❌ 시간 검색 오류:', error);
        alert('시간 검색 중 오류가 발생했습니다.');
        setIsLoadingFlightData(false);
        return;
      }
    }

    if (isCitySearch) {
      console.log('🏙️ 도시 IATA 코드 검색 감지:', flightNum);
      console.log('📊 Firebase DB에서 도시별 항공편 검색...');

      try {
        const { searchFlightSchedulesByCity } = await import('./src/firebase/flightSchedules');
        const cityResults = await searchFlightSchedulesByCity(flightNum);

        if (cityResults.length > 0) {
          console.log('✅ Firebase DB 도시 검색 성공:', cityResults.length, '개');
          const results = cityResults.map(flight => {
            // 항공편 번호에서 항공사 코드 추출 (예: 7C1301 -> 7C)
            const flightNumber = flight.flightNumber || '';
            // 숫자가 나오기 전까지의 문자만 추출 (7C1301 -> 7C)
            const airlineCode = flightNumber.match(/^([A-Z0-9]+?)(?=\d)/)?.[1] || flight.airline || '';

            return {
              flightNumber: flightNumber,
              airline: airlineCode,
              airlineCode: airlineCode,
              departure: flight.departure,
              arrival: flight.arrival,
              time: '',
              aircraft: '',
              status: '스케줄 정보',
              type: 'Firebase DB'
            };
          });
          setFlightSearchResults(results);
          setShowFlightResults(true);
          setIsLoadingFlightData(false); // 로딩 상태 해제
          return;
        } else {
          console.log('❌ 도시 검색 결과 없음');
          alert('도시 코드 "' + (flightNum) + '"에 대한 항공편 검색 결과가 없습니다.\n\n가능한 원인:\n• 해당 도시로 운항하는 항공편이 없음\n• 도시 코드가 잘못됨\n• Firebase 데이터베이스에 해당 도시 정보 없음');
          setIsLoadingFlightData(false); // 로딩 상태 해제
          return;
        }
      } catch (cityError) {
        console.error('❌ Firebase DB 도시 검색 실패:', cityError);
        alert('도시별 항공편 검색 중 오류가 발생했습니다.');
        setIsLoadingFlightData(false); // 로딩 상태 해제
        return;
      }
    }

    try {

      // 인천공항 API 시도 (10초 타임아웃)
      console.log('📡 인천공항 API 호출...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch('/api/incheon/flights', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            flightNumber: flightNum,
            searchType: 'both'
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          console.log('✅ 인천공항 API 응답:', data);

          if (data.results && data.results.length > 0) {
            const formattedFlights = data.results.map((flight: any) => {
              // weeklyData에서 운항 요일 추출
              let operatingDays: string[] = [];
              if (flight.weeklyData && Array.isArray(flight.weeklyData)) {
                operatingDays = flight.weeklyData
                  .filter((f: any) => f.scheduleDate || f.scheduledTime)
                  .map((f: any) => f.scheduleDate || f.scheduledTime);
                console.log('📅 인천공항 API - 운항 일자:', operatingDays);
              }

              // 시간 표시 포맷팅 (일반 검색에서도 적용)
              let displayTime = '';
              if (flight.scheduledDateTime) {
                // YYYYMMDDHHMM 형식 처리
                const timeStr = String(flight.scheduledDateTime);
                if (/^\d{12}$/.test(timeStr)) {
                  displayTime = (timeStr.substring(8, 10)) + ':' + (timeStr.substring(10, 12));
                } else if (/^\d{4}$/.test(timeStr)) {
                  displayTime = (timeStr.substring(0, 2)) + ':' + (timeStr.substring(2, 4));
                } else {
                  displayTime = flight.scheduledDateTime;
                }
              } else if (flight.time) {
                displayTime = flight.time;
              }

              return {
                flightNumber: flight.flightNumber || flight.flightId,
                airline: flight.airline,
                origin: flight.origin || flight.departure,
                departure: flight.origin || flight.departure,
                destination: flight.destination || flight.arrival,
                arrival: flight.destination || flight.arrival,
                time: displayTime, // 포맷팅된 시간 사용
                date: flight.date || flight.scheduledDateTime,
                scheduledTime: flight.scheduledDateTime,
                actualTime: flight.actualDateTime,
                estimatedTime: flight.estimatedDateTime,
                aircraft: flight.aircraft || flight.aircraftType, // 인천공항 API의 통합된 기종 정보
                status: flight.status,
                type: '인천공항 API',
                terminal: flight.terminal,
                gate: flight.gate,
                carousel: flight.carousel,
                chkinrange: flight.chkinrange,
                // 일주일 스케줄 정보 추가
                weeklySchedule: flight.weeklySchedule,
                weeklyData: flight.weeklyData,
                operatingDays: operatingDays.length > 0 ? operatingDays : undefined,
                planTime: displayTime // planTime 추가
              };
            });

            console.log('✅ 인천공항 API 검색 성공:', formattedFlights.length, '개');
            console.log('📊 첫 번째 결과 상세:', formattedFlights[0]);
            setFlightSearchResults(formattedFlights);
            setShowFlightResults(true);
            return;
          } else {
            console.log('⚠️ 인천공항 API: 검색 결과 없음 (빈 결과)');
          }
        } else {
          console.log('⚠️ 인천공항 API: HTTP 오류', response.status);
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.log('⏱️ 인천공항 API 타임아웃 (10초)');
        } else {
          console.log('❌ 인천공항 API 오류:', error.message);
        }
      }

      // Firebase 공유 DB 검색 (API 실패 시 백업으로 사용)
      console.log('📊 Firebase 공유 DB 검색 (백업)...');
      try {
        const { searchFlightSchedules } = await import('./src/firebase/flightSchedules');
        const firebaseResults = await searchFlightSchedules(flightNum);

        if (firebaseResults.length > 0) {
          console.log('✅ Firebase 공유 DB 검색 성공:', firebaseResults.length, '개');
          const results = firebaseResults.map(flight => ({
            flightNumber: flight.flightNumber,
            airline: flight.airline,
            departure: flight.departure,
            arrival: flight.arrival,
            time: '',
            aircraft: '',
            status: '스케줄 정보',
            type: 'Firebase DB'
          }));
          setFlightSearchResults(results);
          setShowFlightResults(true);
        } else {
          console.log('❌ 검색 결과 없음 (모든 소스)');
          alert('항공편 "' + (flightNum) + '"에 대한 검색 결과가 없습니다.\n\n가능한 원인:\n• 해당 항공편이 오늘 운항하지 않음\n• 항공편 번호가 잘못됨\n• API 서비스 일시 중단\n• Firebase 데이터베이스에 해당 항공편 정보 없음');
        }
      } catch (fbError) {
        console.error('❌ Firebase 공유 DB 검색 실패:', fbError);
        alert('검색 중 오류가 발생했습니다.');
      }
    } catch (error: any) {
      console.error('❌ 항공편 검색 오류:', error);
      alert('검색 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingFlightData(false);
    }
  }, [flightSearchQuery]);

  // 오프라인 데이터 로드 로직 제거 (TanStack Query Persister가 처리)



  // 온라인 전환 시 동기화
  const handleSyncWhenOnline = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const result = await syncStrategy.sync(user.uid, flights, async (conflicts) => {
        setConflicts(conflicts);
        setShowConflictModal(true);
        return [];
      });

      if (result.success) {
        if (result.syncedCount > 0 || result.resolvedConflicts > 0) {
          syncStrategy.clearSyncQueue();
          const status = syncStrategy.getSyncStatus();
          setSyncStatus(status);
        }
      }

      if (result.errors.length > 0) {
        const actualErrors = result.errors.filter(e => e !== '이미 동기화 중입니다.');
        if (actualErrors.length > 0) {
          console.error('동기화 오류:', actualErrors);
        }
      }

      if (result.conflicts.length > 0) {
        // 충돌 로그가 있으면 경고 표시 (ConflictInfo[]가 아니므로 state 설정 불가)
        console.warn('동기화 충돌 로그:', result.conflicts);
        // setShowConflictModal(true); // 충돌 정보가 없으므로 모달을 띄우지 않음
      }
    } catch (error) {
      console.error('동기화 중 오류:', error);
    }
  }, [user, flights]);

  // 네트워크 상태 감지는 Service Worker에서 처리됨

  // Web Worker cleanup on unmount


  // 해시 기반 최신성 확인 시스템 (Service Worker 완전 제거됨)
  useEffect(() => {
  }, []);

  // Service Worker 관련 함수 제거됨

  // Service Worker 메시지 리스너 제거됨

  // 초기 데이터 로딩
  useEffect(() => {
    if (user && user.uid) {
      // 10초 타임아웃 설정 (로딩이 너무 오래 지속되는 것을 방지)
      const timeoutId = setTimeout(() => {
        setIsLoading(false);
      }, 10000);

      return () => clearTimeout(timeoutId);
    } else {
      setIsLoading(false);
    }
  }, [user]);



  // 오프라인 모드에서 주기적 데이터 확인 (추가 보험)


  // 동기화 상태 업데이트
  useEffect(() => {
    if (user?.uid) {
      const status = syncStrategy.getSyncStatus();
      setSyncStatus(status);
    }
  }, [user]);



  // 실시간 데이터 구독 (온라인 모드에서만)


  // 실시간 다음/최근 비행 업데이트 (1분마다)


  // 오프라인 모드에서 오프라인 인증 확인 (별도 처리)
  useEffect(() => {
    if (!navigator.onLine && !user) {
      console.log('🔍 오프라인 모드 감지: 오프라인 인증 확인 시작...');
      const offlineAuthData = localStorage.getItem('offline_auth_data');
      console.log('📱 오프라인 인증 데이터:', offlineAuthData ? '존재함' : '없음');

      if (offlineAuthData) {
        try {
          const authData = JSON.parse(offlineAuthData);
          const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

          if (Date.now() - authData.loginTime < sevenDaysInMs) {
            console.log('✅ 오프라인 인증 데이터 유효함, 오프라인 사용자 생성 중...');

            const offlineUser = {
              uid: authData.uid,
              email: authData.email,
              displayName: authData.displayName,
              emailVerified: true,
              isAnonymous: false,
              metadata: {
                creationTime: authData.loginTime.toString(),
                lastSignInTime: authData.loginTime.toString()
              },
              providerData: [],
              refreshToken: '',
              tenantId: null,
              delete: async () => { },
              getIdToken: async () => '',
              getIdTokenResult: async () => ({ token: '', authTime: '', issuedAtTime: '', expirationTime: '', signInProvider: '', signInSecondFactor: null, claims: {} }),
              reload: async () => { },
              toJSON: () => ({})
            };

            setUser(offlineUser);
            console.log('🎯 오프라인 사용자 설정 완료:', offlineUser.uid);

            // 오프라인 사용자 정보 로드
            try {
              const offlineUserData = localStorage.getItem('offline_user_data');
              if (offlineUserData) {
                const userData = JSON.parse(offlineUserData);
                setUserInfo({
                  displayName: userData.displayName || authData.displayName,
                  empl: userData.empl,
                  userName: userData.userName,
                  company: userData.company
                });
              } else {
                setUserInfo({
                  displayName: authData.displayName,
                  empl: undefined,
                  userName: authData.userName,
                  company: authData.company
                });
              }

              console.log('📋 오프라인 사용자 정보 로드 완료');

              // 오프라인 모드 데이터 로드 (메모 등)
              try {
                // 병렬로 데이터 로드 시작
                Promise.allSettled([
                  getCrewMemos(offlineUser.uid).then(res => setCrewMemos(res)),
                  getCityMemos(offlineUser.uid).then(res => setCityMemos(res)),
                  getDocumentExpiryDates(offlineUser.uid).then(res => setCardExpiryDates(res))
                ]).then(() => {
                  console.log('✅ 오프라인 데이터(메모 등) 로드 완료');
                });
              } catch (dataLoadError) {
                console.error('❌ 오프라인 데이터 로드 실패:', dataLoadError);
              }
            } catch (error) {
              console.error('❌ 오프라인 사용자 정보 로드 실패:', error);
              setUserInfo({
                displayName: authData.displayName,
                empl: undefined,
                company: undefined
              });
            }
          } else {
            console.log('⚠️ 오프라인 인증 데이터 만료됨');
          }
        } catch (error) {
          console.error('❌ 오프라인 인증 데이터 파싱 실패:', error);
        }
      } else {
        console.log('❌ 오프라인 인증 데이터 없음 - 로그인 필요');
      }
    }
  }, [navigator.onLine, user]);

  // 인증 상태 감지 (온라인/오프라인 감지 포함)
  useEffect(() => {

    const unsubscribe = onAuthStateChange(async (user) => {
      if ((import.meta as any).env?.DEV) {
        // console.log('🚀 onAuthStateChange 트리거됨, user:', user);
      }

      // Firebase 인증 상태 처리 (온라인 모드에서만)

      setUser(user);
      if (!user) {

        setIsLoading(false);
        setUserInfo(null); // 로그아웃 시 사용자 정보 초기화
        setSelectedAirline('OZ'); // 로그아웃 시 기본값으로 리셋
        setSelectedCurrencyCards(['passport', 'visa', 'epta', 'radio', 'whitecard', 'crm']); // 로그아웃 시 기본 카드로 리셋
        setCardExpiryDates({}); // 로그아웃 시 문서 만료일 데이터 초기화
        setCrewMemos({}); // 로그아웃 시 crew 메모 데이터 초기화
        setCityMemos({}); // 로그아웃 시 도시 메모 데이터 초기화
        setIsUserAdmin(null); // 로그아웃 시 관리자 상태 초기화
        clearKeyCache(); // 로그아웃 시 암호화 키 캐시 정리

        // 로그아웃 시 모든 사용자 데이터 삭제 (테마 설정 제외)
        try {
          const { clearAllUserData } = await import('./utils/logoutDataCleanup');
          await clearAllUserData();
        } catch (dataCleanupError) {
          console.error('❌ App.tsx에서 사용자 데이터 삭제 중 오류:', dataCleanupError);
        }

        // 로그아웃 시 세션 타임아웃 정리
        if (sessionTimeout) {
          sessionTimeout.clearTimeout();
          setSessionTimeout(null);
        }
      } else {
        // 로그인 성공 시
        // 로그인 성공 시

        // 모든 비동기 작업을 감싸는 try-finally 블록 시작
        try {
          // Promise with timeout helper
          const withTimeout = <T,>(promise: Promise<T>, ms: number, fallbackValue?: T): Promise<T> => {
            let timeoutId: NodeJS.Timeout;
            const timeoutPromise = new Promise<T>((_, reject) => {
              timeoutId = setTimeout(() => {
                if (fallbackValue !== undefined) {
                  // 타임아웃 시 fallback 값 반환 (reject 하지 않음)
                  // console.warn(`Async operation timed out after ${ms}ms, using fallback.`);
                  // resolve(fallbackValue); 
                  // Promise.race에서는 resolve를 외부에서 제어하기 까다로우므로 reject로 처리하고 catch에서 핸들링하거나
                  // 여기서는 단순히 reject하고 호출부에서 catch하는게 깔끔함.
                  reject(new Error(`Operation timed out after ${ms}ms`));
                } else {
                  reject(new Error(`Operation timed out after ${ms}ms`));
                }
              }, ms);
            });
            return Promise.race([
              promise.then(res => {
                clearTimeout(timeoutId);
                return res;
              }),
              timeoutPromise
            ]).catch(err => {
              if (fallbackValue !== undefined) return fallbackValue;
              throw err;
            });
          };

          // 1. 데이터베이스 연결 테스트 (비차단)


          // 2. 사용자 정보 가져오기 (EMPL 정보 포함)
          // 5초 타임아웃
          try {
            const userInfoData = await withTimeout(
              // 사용자 정보 가져오기
              getUserInfo(user.uid),
              5000,
              null
            );

            if (userInfoData) {
              setUserInfo({
                displayName: userInfoData.displayName,
                empl: userInfoData.empl,
                userName: userInfoData.userName,
                company: userInfoData.company
              });
              setSelectedAirline((userInfoData as any).airline || 'KAL'); // 기본값 KAL 설정

              // FCM 토큰 등록 (온라인 알림용)
              import('./src/firebase/fcm').then(({ requestFcmToken }) => {
                requestFcmToken(user.uid).catch(err => console.error('FCM Token Error:', err));
              }).catch(err => console.error('FCM Module Load Error:', err));

              // 🔧 마이그레이션: 기존 데이터 인덱싱 (앱 버전별 1회 실행)
              const MIGRATION_KEY = 'alarm_index_migration_v1';
              if (!localStorage.getItem(MIGRATION_KEY)) {
                syncAlarmIndexes(user.uid).then(() => {
                  localStorage.setItem(MIGRATION_KEY, 'done');
                });
              }

              // 🔔 친구 요청 실시간 구독
              subscribeFriendRequests(user.uid, (requests) => {
                const currentCount = requests.length;
                if (friendRequestCountRef.current === -1) {
                  // 첫 로딩 시 현재 개수만 저장
                  friendRequestCountRef.current = currentCount;
                } else if (currentCount > friendRequestCountRef.current) {
                  // 새 요청 감지
                  const latestRequest = requests[requests.length - 1];
                  setFriendRequestAlert({
                    name: latestRequest.fromName || latestRequest.fromEmail || '누군가',
                    id: latestRequest.fromUserId || 'unknown'
                  });
                  // 5초 후 자동 닫기
                  setTimeout(() => setFriendRequestAlert(null), 5000);
                }
                friendRequestCountRef.current = currentCount;
              });

              // 🔄 이메일 계정 사용자에게 카카오 전환 권유
              if (!user.uid.startsWith('kakao:')) {
                const dismissed = sessionStorage.getItem('kakao_switch_dismissed');
                if (!dismissed) {
                  setShowKakaoSwitchPopup(true);
                }
              }
            } else {
              // 타임아웃이나 null인 경우 기본값
              setUserInfo({
                displayName: user.displayName,
                empl: undefined,
                company: undefined
              });
            }
          } catch (error) {
            console.error('❌ 사용자 정보 로드 실패:', error);
            setUserInfo({
              displayName: user.displayName,
              empl: undefined,
              company: undefined
            });
          }

          // 3. 관리자 권한 확인
          // 5초 타임아웃
          // 5초 타임아웃
          try {
            setIsUserAdmin(null);
            const { isAdmin } = await import('./src/firebase/auth');
            const adminStatus = await withTimeout(isAdmin(user.uid), 5000, false);

            setIsUserAdmin(adminStatus);
          } catch (error) {
            console.error('❌ 관리자 권한 확인 실패:', error);
            setIsUserAdmin(false);
          }

          // 4. 세션 타임아웃 설정
          const timeout = createSessionTimeout(30 * 60 * 1000);
          setSessionTimeout(timeout);

          // 5. 사용자 설정 및 문서 만료일 불러오기
          try {
            // 각각의 설정 로드도 타임아웃 적용 (병렬 처리 가능하지만 안전하게 순차 처리하되 타임아웃 적용)
            const userSettingsPromise = getUserSettings(user.uid);
            const userSettings = await withTimeout(userSettingsPromise, 5000, {});

            if (userSettings.airline) {
              setSelectedAirline(userSettings.airline);
            }
            if (userSettings.base) {
              setBaseIata(String(userSettings.base).toUpperCase());
            }
            if (userSettings.selectedCurrencyCards) {
              setSelectedCurrencyCards(userSettings.selectedCurrencyCards);
            }

            // 나머지 비동기 데이터들 (실패해도 앱 실행엔 지장 없음)
            // 병렬로 시작하고 에러만 로그 찍기
            Promise.allSettled([
              getDocumentExpiryDates(user.uid).then(res => setCardExpiryDates(res)),
              getCrewMemos(user.uid).then(res => setCrewMemos(res)),
              getCityMemos(user.uid).then(res => setCityMemos(res))
            ]).catch(e => console.error('Additional data load error', e));

          } catch (error) {
            console.error('사용자 설정 불러오기 실패:', error);
          }
        } catch (fatalError) {
          console.error('🔥 초기화 프로세스 중 치명적 오류:', fatalError);
        } finally {
          // 어떤 상황에서도 로딩 해제 보장
          setIsLoading(false);
        }
      }
    });

    return unsubscribe;
  }, []);

  // 사용자 활동 감지하여 세션 타임아웃 리셋
  useEffect(() => {
    const handleUserActivity = () => {
      if (sessionTimeout && user) {
        sessionTimeout.resetTimeout();
      }
    };

    window.addEventListener('mousedown', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);

    return () => {
      window.removeEventListener('mousedown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
    };
  }, [sessionTimeout, user]);

  // 월별 데이터 삭제 핸들러
  const handleDeleteMonthData = async (year: number, month: number) => {
    if (!user) {
      console.error('사용자가 로그인되지 않았습니다.');
      setUploadError('로그인이 필요합니다.');
      setTimeout(() => setUploadError(''), 5000);
      return;
    }


    try {
      setIsDeletingData(true);

      // 해당 년월의 모든 비행 데이터 찾기
      const flightsToDelete = flights.filter(flight => {
        if (!flight.date) return false;
        const date = new Date(flight.date);
        return date.getFullYear() === year && date.getMonth() + 1 === month;
      });


      // 각 비행 데이터 삭제
      for (const flight of flightsToDelete) {
        // 삭제 중
        if (flight._storagePath) {
          await deleteFlight(flight.id, flight._storagePath, user.uid);
        } else {
          console.error('저장 경로 정보가 없습니다:', flight);
        }
      }

      // 🗑️ IndexedDB 캐시도 함께 삭제
      try {
        const { indexedDBCache } = await import('./utils/indexedDBCache');
        await indexedDBCache.clearCache(user.uid);
      } catch (cacheError) {
        console.error('❌ IndexedDB 캐시 삭제 실패:', cacheError);
      }

      // 업데이트된 데이터 다시 로드
      const updatedFlights = await getAllFlights(user.uid);
      // 업데이트된 데이터 다시 로드 (Query Invalidation)
      queryClient.invalidateQueries({ queryKey: flightKeys.list(user.uid) });

      setUploadMessage((year) + '년 ' + (month) + '월 데이터가 삭제되었습니다.');
      setTimeout(() => setUploadMessage(''), 3000);

    } catch (error) {
      console.error('데이터 삭제 오류:', error);
      setUploadError('데이터 삭제 중 오류가 발생했습니다.');
      setTimeout(() => setUploadError(''), 5000);
    } finally {
      setIsDeletingData(false);
    }
  };

  // 회사별 허용 파일 형식 결정
  const getAllowedFileTypes = (company: string): string => {
    if (company === 'KE' || company === 'OZ') {
      return '.xls,.xlsx,.png,.jpg,.jpeg';
    } else if (company === '7C') {
      return '.pdf';
    }
    return '.xls,.xlsx,.pdf,.png,.jpg,.jpeg'; // 기본값
  };

  // 파일 업로드 핸들러
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isImageFile = ['png', 'jpg', 'jpeg'].includes(fileExtension || '');

    // 기본 파일 형식 검증
    if (fileExtension !== 'xls' && fileExtension !== 'xlsx' && fileExtension !== 'pdf' && !isImageFile) {
      setUploadError('Excel(.xls, .xlsx), PDF(.pdf) 또는 이미지(.png, .jpg) 파일만 업로드 가능합니다.');
      setTimeout(() => setUploadError(''), 5000);
      return;
    }

    try {
      setIsUploading(true);
      setUploadError('');

      // 사용자의 회사 정보 및 개인 정보 가져오기
      let userCompany = 'OZ'; // 기본값
      let userName = '';
      let empl = '';

      console.log('🔍 사용자 정보 확인:', {
        user: !!user,
        userId: user?.uid,
        defaultCompany: userCompany
      });

      if (user) {
        try {
          const userInfo = await getUserInfo(user.uid);
          console.log('🔍 사용자 정보 조회 결과:', userInfo);

          if (userInfo) {
            if (userInfo.company) {
              userCompany = userInfo.company;
              console.log('✅ 사용자 회사 정보 설정:', userCompany);
            } else {
              console.warn('⚠️ 사용자 회사 정보가 없습니다. 기본값 사용:', userCompany);
            }

            if (userInfo.empl) {
              empl = userInfo.empl;
            }

            // 사용자 이름 가져오기 (암호화된 userName 우선, 없으면 displayName 사용)
            if (userInfo.userName) {
              userName = userInfo.userName;
            } else if (user.displayName) {
              userName = user.displayName;
            }
          } else {
            console.warn('⚠️ 사용자 정보가 없습니다. 기본값 사용');
          }
        } catch (error) {
          console.error('❌ 사용자 정보를 가져올 수 없습니다:', error);
        }
      } else {
        console.warn('⚠️ 로그인된 사용자가 없습니다. 기본값 사용');
      }

      // 회사별 파일 형식 제한 검증
      if (!isImageFile) {
        if (userCompany === 'KE' || userCompany === 'OZ') {
          if (fileExtension !== 'xls' && fileExtension !== 'xlsx') {
            setUploadError((userCompany) + ' 항공사는 Excel 파일(.xls, .xlsx) 또는 스크린샷 이미지만 업로드 가능합니다.');
            setTimeout(() => setUploadError(''), 5000);
            return;
          }
        } else if (userCompany === '7C') {
          if (fileExtension !== 'pdf') {
            setUploadError('제주항공(7C)은 PDF 파일(.pdf)만 업로드 가능합니다.');
            setTimeout(() => setUploadError(''), 5000);
            return;
          }
        }
      }

      // 파일 타입에 따라 적절한 파서 선택
      let newFlights: Flight[];
      let isPDFFile = false;
      // 직전 업로드 시각을 보존하여 이번 배치에서 변경된 항목만 표시하기 위한 기준 저장
      try {
        const prevUploadAt = localStorage.getItem('last_upload_at') || '';
        localStorage.setItem('last_upload_prev', prevUploadAt);
      } catch { }
      // 업로드 전 전체 스냅샷 확보 (변경 날짜 계산용)
      const { getAllFlights: getAllFlightsFn } = await import('./src/firebase/database');
      const prevAllFlights = user ? await getAllFlightsFn(user.uid) : [];

      console.log('🔍 파일 업로드 시작:', {
        fileName: file.name,
        fileExtension,
        userCompany,
        userName,
        empl
      });

      if (isImageFile) {
        console.log('🖼️ 이미지 OCR 파싱 시작');
        setUploadMessage('🔍 스케줄 이미지 분석 중... AI가 데이터를 추출하고 있습니다.');

        // 이미지를 Base64로 변환 및 리사이징 (Vercel 4.5MB 제한 회피용)
        const imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              const MAX_SIZE = 1600; // Vercel 4.5MB payload 에러 방지용 최대 해상도 원복

              if (width > height) {
                if (width > MAX_SIZE) {
                  height *= MAX_SIZE / width;
                  width = MAX_SIZE;
                }
              } else {
                if (height > MAX_SIZE) {
                  width *= MAX_SIZE / height;
                  height = MAX_SIZE;
                }
              }

              canvas.width = Math.floor(width);
              canvas.height = Math.floor(height);
              const ctx = canvas.getContext('2d');
              if (ctx) {
                // 검은 배경 채우기 (투명도 방지)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, width, height);
                // JPEG, 80% 퀄리티로 압축 (용량 1~2MB 내외로 유지됨)
                const dataURL = canvas.toDataURL('image/jpeg', 0.8);
                resolve(dataURL.split(',')[1]);
              } else {
                reject(new Error("Canvas 2D context not available"));
              }
            };
            img.onerror = reject;
            // object URL 보다는 dataURL을 이미지 소스로
            img.src = e.target?.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // 리사이징 후 포맷이 JPEG로 고정되므로 헤더도 JPEG로 변경
        const mimeType = 'image/jpeg';

        // OCR API 호출
        const ocrResponse = await fetch('/api/ocr-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64, mimeType })
        });

        if (!ocrResponse.ok) {
          const errorData = await ocrResponse.json();
          throw new Error(errorData.error || '이미지 분석 실패');
        }

        const ocrResult = await ocrResponse.json();
        console.log('🖼️ OCR 결과:', { rows: ocrResult.rowCount });
        setUploadMessage('✅ 이미지 분석 완료! 데이터 처리 중...');

        // OCR 결과를 기존 OZ 파서로 전달
        const { parseOZExcel } = await import('./utils/companyParsers/ozParser');
        newFlights = parseOZExcel(ocrResult.data, user?.uid);
        console.log('🖼️ OCR 파싱 완료:', { flightsCount: newFlights.length });
      } else if (fileExtension === 'pdf') {
        console.log('📄 PDF 파일 파싱 시작');
        const { parsePDFFile } = await import('./utils/pdfParser');
        newFlights = await parsePDFFile(file, userCompany, userName, empl);
        isPDFFile = true;
        console.log('📄 PDF 파일 파싱 완료:', { flightsCount: newFlights.length });
      } else {
        console.log('📊 Excel 파일 파싱 시작');
        const { parseExcelFile } = await import('./utils/excelParser');
        newFlights = await parseExcelFile(file, userCompany, userName, empl);
        console.log('📊 Excel 파일 파싱 완료:', { flightsCount: newFlights.length });
      }

      // 파일에서 년월 정보 추출 (첫 번째 비행의 날짜 기준)
      let targetYear = new Date().getFullYear();
      let targetMonth = new Date().getMonth() + 1;

      if (newFlights.length > 0 && newFlights[0].date) {
        const firstFlightDate = new Date(newFlights[0].date);
        targetYear = firstFlightDate.getFullYear();
        targetMonth = firstFlightDate.getMonth() + 1;
      } else {
      }

      // ✨ 스마트 업데이트 실행 (기존 데이터와 병합)

      // PDF 파일의 경우 파서에서 이미 Firebase 저장했으므로 건너뛰기
      if (isPDFFile) {
        // 업데이트된 데이터 다시 로드
        const updatedFlights = await getAllFlightsFn(user.uid);
        // 업데이트된 데이터 다시 로드
        queryClient.invalidateQueries({ queryKey: flightKeys.list(user.uid) });
        // 변경 날짜 계산 및 저장
        try {
          const changedDatesSet = new Set<string>();
          if (prevAllFlights && prevAllFlights.length > 0) {
            const makeDateSignature = (flightsArr: any[], date: string) => {
              const items = flightsArr
                .filter(f => f.date === date && !(f.route === '' && (!f.crew || f.crew.length === 0) && (!f.cabinCrew || f.cabinCrew.length === 0)))
                .map((f: any) => (f.flightNumber || '') + '|' + (f.scheduleType || '') + '|' + (f.route || '') + '|' + (f.std || '') + '|' + (f.sta || '') + '|' + (f.acType || '') + '|' + (f.departureDateTimeUtc || '') + '|' + (f.arrivalDateTimeUtc || '') + '|' + (f.showUpDateTimeUtc || ''))
                .sort();
              return items.join('||');
            };
            const allDates = new Set<string>([...prevAllFlights, ...updatedFlights].map((f: any) => f.date));
            for (const d of allDates) {
              const beforeSig = makeDateSignature(prevAllFlights, d);
              const afterSig = makeDateSignature(updatedFlights, d);
              if (beforeSig !== afterSig) changedDatesSet.add(d);
            }
          }
          const stamp = new Date().toISOString();
          localStorage.setItem('last_upload_changed_dates', JSON.stringify({ at: stamp, dates: Array.from(changedDatesSet) }));
          localStorage.setItem('last_upload_at', stamp);
        } catch { }
        return;
      }

      // 업로드된 파일에 포함된 모든 월의 데이터 가져오기
      const allExistingFlights = await getAllFlightsFn(user.uid);


      // 메인 월 추정 (KE 파서: monthlyTotalBlock이 설정된 월을 우선, 없으면 최빈 월)
      const monthScoreMap: Record<string, number> = {};
      for (const f of newFlights) {
        try {
          const d = new Date(f.date);
          if (isNaN(d.getTime())) continue;
          const key = (d.getFullYear()) + '-' + (d.getMonth() + 1); // 1-based month (zero-pad 불필요: 아래와 동일 포맷)
          const weight = f.monthlyTotalBlock ? 10 : 1; // 파일의 대표 월 신뢰도 가중치
          monthScoreMap[key] = (monthScoreMap[key] || 0) + weight;
        } catch { }
      }
      let mainMonthKey = '';
      let mainMonthScore = -1;
      for (const [k, v] of Object.entries(monthScoreMap)) {
        if (v > mainMonthScore) {
          mainMonthKey = k;
          mainMonthScore = v;
        }
      }

      // 업로드된 파일의 월별 데이터 분리
      const flightsByMonth = newFlights.reduce((acc, flight) => {
        const flightDate = new Date(flight.date);
        const year = flightDate.getFullYear();
        const month = flightDate.getMonth() + 1;
        const key = (year) + '-' + (month);

        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(flight);

        return acc;
      }, {} as Record<string, typeof newFlights>);


      // 각 월별로 스마트 병합 실행
      for (const [monthKey, monthFlights] of Object.entries(flightsByMonth)) {
        const [year, month] = monthKey.split('-').map(Number);


        // 해당 월의 기존 데이터만 필터링
        const monthExistingFlights = allExistingFlights.filter(flight => {
          const flightDate = new Date(flight.date);
          return flightDate.getFullYear() === year && flightDate.getMonth() + 1 === month;
        });


        // 브리핑 정보 파일인지 감지 (isBriefingInfo 플래그 확인)
        const isBriefingFile = monthFlights.some(flight => flight.isBriefingInfo === true);

        // 스마트 병합 실행
        // - 브리핑 정보 파일인 경우: 기존 데이터 삭제하지 않고 추가/갱신만 수행
        // - 일반 스케줄 파일인 경우: 대표 월에는 누락 스케줄 삭제 적용
        // - 대표 월이 아닌 월(말일/월초 걸침)은 삭제하지 않고 추가/갱신만 수행하여 이전달 데이터 보존
        const isMainMonth = monthKey === mainMonthKey;
        const shouldRemoveMissing = isMainMonth && !isBriefingFile; // 브리핑 파일이면 삭제하지 않음

        const mergedFlights = mergeFlightDataWithStatusPreservation(
          monthExistingFlights,
          monthFlights,
          { removeMissing: shouldRemoveMissing }
        );

        // BRIEFING INFO 데이터가 포함된 경우 로그 출력
        if (isBriefingFile) {
          console.log('📋 브리핑 정보 파일 감지됨 - 기존 데이터 보존 모드');
        }

        // 병합된 데이터를 Firebase에 저장 (월별로 교체)
        await replaceMonthDataWithStatusPreservation(mergedFlights, user.uid, year, month);

      }

      // 업데이트된 데이터 다시 로드
      const updatedFlights = await getAllFlightsFn(user.uid);
      // 업데이트된 데이터 다시 로드
      queryClient.invalidateQueries({ queryKey: flightKeys.list(user.uid) });
      // 변경 날짜 계산 및 저장
      try {
        const changedDatesSet = new Set<string>();
        if (prevAllFlights && prevAllFlights.length > 0) {
          const makeDateSignature = (flightsArr: any[], date: string) => {
            const items = flightsArr
              .filter(f => f.date === date && !(f.route === '' && (!f.crew || f.crew.length === 0) && (!f.cabinCrew || f.cabinCrew.length === 0)))
              .map((f: any) => (f.flightNumber || '') + '|' + (f.scheduleType || '') + '|' + (f.route || '') + '|' + (f.std || '') + '|' + (f.sta || '') + '|' + (f.acType || '') + '|' + (f.departureDateTimeUtc || '') + '|' + (f.arrivalDateTimeUtc || '') + '|' + (f.showUpDateTimeUtc || ''))
              .sort();
            return items.join('||');
          };
          const allDates = new Set<string>([...prevAllFlights, ...updatedFlights].map((f: any) => f.date));
          for (const d of allDates) {
            const beforeSig = makeDateSignature(prevAllFlights, d);
            const afterSig = makeDateSignature(updatedFlights, d);
            if (beforeSig !== afterSig) changedDatesSet.add(d);
          }
        }
        const stamp = new Date().toISOString();
        localStorage.setItem('last_upload_changed_dates', JSON.stringify({ at: stamp, dates: Array.from(changedDatesSet) }));
        localStorage.setItem('last_upload_at', stamp);
      } catch { }

      // ✨ 스마트 업데이트 결과 메시지
      const totalNewCount = updatedFlights.length - allExistingFlights.length;
      const totalUpdatedCount = updatedFlights.filter(f => f.version && f.version > 0).length;

      const processedMonths = Object.keys(flightsByMonth).map(key => {
        const [year, month] = key.split('-');
        return (year) + '년 ' + (month) + '월';
      }).join(', ');

      setUploadMessage('✅ 다중 월 스마트 업데이트 완료 (' + (processedMonths) + '): ' + (totalNewCount) + '개 추가, ' + (totalUpdatedCount) + '개 업데이트, 이착륙 상태 보존됨');
      setTimeout(() => setUploadMessage(''), 8000);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('파일 업로드 오류:', error);
      setUploadError('파일 업로드 중 오류가 발생했습니다.');
      setTimeout(() => setUploadError(''), 5000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // 관리자 전용 JSON 업로드 핸들러
  const handleJsonUploadClick = () => {
    console.log('🔍 JSON 업로드 버튼 클릭됨');
    console.log('🔍 관리자 상태:', isUserAdmin);

    if (isUserAdmin === null) {
      console.log('⏳ 관리자 권한 확인 중...');
      alert('⏳ 관리자 권한을 확인하는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    if (!isUserAdmin) {
      console.log('❌ 관리자 권한 없음');
      alert('❌ 관리자 권한이 필요합니다. Firebase Console에서 admin 노드에 UID를 추가해주세요.');
      return;
    }

    console.log('✅ 관리자 권한 확인됨 - 파일 선택 다이얼로그 열기');
    console.log('🔍 jsonFileInputRef.current:', jsonFileInputRef.current);

    // 파일 input이 존재하는지 확인
    if (!jsonFileInputRef.current) {
      console.error('❌ JSON 파일 input 요소를 찾을 수 없습니다');
      alert('❌ 파일 업로드 기능을 초기화하는 중 오류가 발생했습니다. 페이지를 새로고침해주세요.');
      return;
    }

    try {
      // 브라우저 호환성을 위해 setTimeout 사용
      setTimeout(() => {
        console.log('🔍 파일 선택 창 열기 시도...');
        jsonFileInputRef.current?.click();
        console.log('✅ 파일 선택 창 열기 완료');
      }, 100);
    } catch (error) {
      console.error('❌ 파일 선택 창 열기 실패:', error);
      alert('❌ 파일 선택 창을 여는 중 오류가 발생했습니다.');
    }
  };

  // JSON 파일 업로드 처리
  const handleJsonFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('🔍 파일 선택됨:', file?.name, file?.size, 'bytes');

    if (!file) {
      console.log('❌ 파일이 선택되지 않음');
      return;
    }

    if (isUserAdmin === null) {
      console.log('⏳ 관리자 권한 확인 중 - 업로드 중단');
      alert('⏳ 관리자 권한을 확인하는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    if (!isUserAdmin) {
      console.log('❌ 관리자 권한 없음 - 업로드 중단');
      alert('❌ 관리자 권한이 필요합니다.');
      return;
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    console.log('🔍 파일 확장자:', fileExtension);

    if (fileExtension !== 'json') {
      console.log('❌ JSON 파일이 아님');
      setUploadError('JSON 파일(.json)만 업로드 가능합니다.');
      setTimeout(() => setUploadError(''), 5000);
      return;
    }

    console.log('✅ JSON 파일 확인됨 - 업로드 시작');
    setIsUploading(true);
    setUploadError('');
    setUploadMessage('');

    try {
      // JSON 파일 읽기
      console.log('🔍 JSON 파일 읽기 시작...');
      const fileContent = await file.text();
      console.log('📊 파일 내용 길이:', fileContent.length, 'characters');

      console.log('🔍 JSON 파싱 시작...');
      const jsonData = JSON.parse(fileContent);
      console.log('📊 JSON 파일 파싱 완료:', Object.keys(jsonData));

      // Firebase에 업로드
      console.log('🔍 Firebase 업로드 함수 호출...');
      const { uploadFlightSchedulesFromJSON } = await import('./src/firebase/flightSchedules');
      const result = await uploadFlightSchedulesFromJSON(jsonData);

      console.log('📊 업로드 결과:', result);

      if (result.success) {
        console.log('✅ 업로드 성공');
        setUploadMessage('✅ ' + (result.message));
        setTimeout(() => setUploadMessage(''), 8000);
      } else {
        console.log('❌ 업로드 실패:', result.message);
        setUploadError('❌ ' + (result.message));
        setTimeout(() => setUploadError(''), 8000);
      }

      // 파일 input 초기화
      if (jsonFileInputRef.current) {
        jsonFileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('❌ JSON 파일 업로드 오류:', error);
      console.error('❌ 오류 상세:', error instanceof Error ? error.stack : error);
      setUploadError('JSON 파일 업로드 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
      setTimeout(() => setUploadError(''), 5000);
    } finally {
      console.log('🔍 업로드 프로세스 완료');
      setIsUploading(false);
    }
  };

  // 캐시 삭제 및 하드 새로고침 함수
  const handleHardRefresh = async () => {
    if (isRefreshing) return;
    if (!navigator.onLine) {
      setRefreshMessage('오프라인 상태에서는 새로고침을 수행하지 않습니다.');
      setTimeout(() => setRefreshMessage(''), 2000);
      return;
    }

    setIsRefreshing(true);
    setRefreshMessage('캐시 정리 중...');
    try {
      // 1) 브라우저 캐시 삭제
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
      }

      // 2) IndexedDB 캐시는 유지 (사용자 데이터 보호)
      if ('indexedDB' in window) {
        console.log('ℹ️ IndexedDB 캐시는 새로고침 시 유지됩니다.');
      }

      // 3) Local Storage 정리 (오프라인 인증 데이터 유지)
      try {
        const offlineAuthData = localStorage.getItem('offline_auth_data');
        const offlineUserData = localStorage.getItem('offline_user_data');
        localStorage.clear();
        sessionStorage.clear();
        if (offlineAuthData) localStorage.setItem('offline_auth_data', offlineAuthData);
        if (offlineUserData) localStorage.setItem('offline_user_data', offlineUserData);
      } catch (error) {
        console.warn('⚠️ Storage 정리 중 오류:', error);
      }

      // 4) 수동 요청: 최신 index.html 강제 조회 후 하드 리로드 (브라우저 새로고침 효과)
      setRefreshMessage('캐시 삭제 완료! 최신 버전 확인 중...');
      try {
        await fetch('/index.html?ts=' + (Date.now()), {
          method: 'GET',
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
      } catch { }
      setRefreshMessage('최신 버전 반영 중...');
      setTimeout(() => {
        setRefreshMessage('');
        window.location.reload();
      }, 300);
    } catch (error) {
      console.error('❌ 새로고침 처리 중 오류:', error);
      setRefreshMessage('오류가 발생했습니다. 다시 시도해주세요.');
      setTimeout(() => setRefreshMessage(''), 2000);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 비행 상태 업데이트 핸들러
  const handleUpdateFlightStatus = async (flightId: number, statusToToggle: 'departed' | 'landed') => {
    if (!user?.uid) return;

    // 항공편 찾기
    const flightToUpdate = flights.find(f => String(f.id) === String(flightId));
    if (!flightToUpdate) {
      console.error('항공편을 찾을 수 없음:', flightId);
      return;
    }

    try {
      const updatedStatus = {
        ...flightToUpdate.status,
        [statusToToggle]: !flightToUpdate.status?.[statusToToggle]
      };

      await updateFlightMutation.mutateAsync({
        flightId,
        dataToUpdate: {
          status: updatedStatus,
          lastModified: new Date().toISOString()
        },
        userId: user.uid
      });
    } catch (error) {
      console.error('비행 상태 업데이트 오류:', error);
      alert('상태 업데이트 중 오류가 발생했습니다.');
    }
  };

  // 로그인 관련 핸들러들
  const handleLoginClick = () => {
    setIsLoginModalOpen(true);
  };

  const handleLoginClose = () => {
    setIsLoginModalOpen(false);
    setLoginError('');
  };

  const handleLogin = async (email: string, password: string) => {
    setIsLoginLoading(true);
    setLoginError('');

    try {
      const result = await loginUser(email, password);

      if (result.success) {
        setIsLoginModalOpen(false);
      } else {
        // 로그인 실패
        setLoginError(result.error || '로그인에 실패했습니다.');
      }
    } catch (error: any) {
      setLoginError(error.message || '로그인에 실패했습니다.');
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Firebase 로그아웃 (내부적으로 모든 사용자 데이터 삭제 포함)
      await logoutUser();
      setUser(null);
      setUserInfo(null);
      // TanStack Query 캐시 초기화는 user가 null이 되면 자동으로 처리됨 (useFlights enabled 옵션)
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };






  const handleShowRegister = () => {
    setIsLoginModalOpen(false);
    setIsRegisterModalOpen(true);
  };

  const handleRegisterClose = () => {
    setIsRegisterModalOpen(false);
    setRegisterError('');
  };

  const handleRegister = async (email: string, password: string, displayName: string, company: string, empl?: string) => {
    setIsRegisterLoading(true);
    setRegisterError('');

    try {
      const result = await registerUser(email, password, displayName, company, empl);

      if (result.success) {
        // 회원가입 성공 - 바로 사용 가능
        setIsRegisterModalOpen(false);

        // 회원가입 후 사용자 정보 자동 업데이트
        const currentUser = getCurrentUser();
        if (currentUser) {
          try {
            const userInfoData = await getUserInfo(currentUser.uid);
            if (userInfoData) {
              setUserInfo({
                displayName: userInfoData.displayName,
                empl: userInfoData.empl,
                userName: userInfoData.userName,
                company: userInfoData.company
              });
            }
          } catch (error) {
            console.error('❌ 회원가입 후 사용자 정보 업데이트 실패:', error);
          }
        }
      } else {
        // 가입 실패
        setRegisterError(result.error || '회원가입에 실패했습니다.');
      }
    } catch (error: any) {
      setRegisterError(error.message || '회원가입에 실패했습니다.');
    } finally {
      setIsRegisterLoading(false);
    }
  };

  const handlePasswordReset = async (email: string) => {
    try {
      await resetPassword(email);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  // 비행 카드 클릭 핸들러 - useCallback으로 최적화
  const handleFlightCardClick = useCallback((flight: Flight, type: 'last' | 'next' | 'nextNext') => {
    if (!flight) {
      setNoFlightModal({ isOpen: true, type });
      return;
    }
    setSelectedFlight(flight);
    setSelectedFlightType(type);
  }, []);

  // 이륙/착륙 상태 변경 핸들러
  const handleStatusChange = useCallback(async (flightId: string | number, status: Partial<FlightStatus>) => {
    if (!user?.uid) return;

    try {
      const flight = flights.find(f => f.id === flightId);
      if (!flight) return;

      const updatedStatus = {
        ...flight.status,
        ...status
      };

      // Mutation 사용
      await updateFlightMutation.mutateAsync({
        flightId: Number(flightId),
        dataToUpdate: { status: updatedStatus },
        userId: user.uid
      });

      // monthlyModalData 업데이트 (필요한 경우)
      if (monthlyModalData) {
        setMonthlyModalData(prev => {
          if (!prev) return null;
          return {
            ...prev,
            flights: prev.flights.map(f =>
              f.id === flightId ? { ...f, status: updatedStatus } : f
            )
          };
        });
      }

      // selectedFlight 업데이트
      if (selectedFlight && selectedFlight.id === flightId) {
        setSelectedFlight(prev => prev ? { ...prev, status: updatedStatus } : null);
      }

    } catch (error) {
      console.error('상태 변경 오류:', error);
    }
  }, [flights, monthlyModalData, selectedFlight, user, updateFlightMutation]);

  // 모달 관련 핸들러들 - useCallback으로 최적화
  // 친구 스케줄 보기 핸들러
  const handleViewFriendSchedule = async (friendUid: string, friendName: string) => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed

      const friendFlights = await getAllFlights(friendUid);

      if (friendFlights && friendFlights.length > 0) {
        // 현재 월의 비행만 필터링
        const filteredFlights = friendFlights.filter((f: Flight) => {
          const fDate = new Date(f.date);
          return fDate.getFullYear() === currentYear && fDate.getMonth() === currentMonth;
        });

        const blockMinutes = filteredFlights.reduce((acc: number, f: Flight) => {
          return acc + (f.block || 0);
        }, 0);

        const h = Math.floor(blockMinutes / 60);
        const m = blockMinutes % 60;
        const blockTimeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        setFriendModalData({
          month: currentMonth,
          year: currentYear,
          flights: filteredFlights,
          blockTime: blockTimeStr
        });
        setFriendUserInfo({ displayName: friendName });
      } else {
        alert('친구의 비행 데이터가 없습니다.');
      }
    } catch (error) {
      console.error('친구 스케줄 가져오기 실패:', error);
      alert('친구의 스케줄을 가져오는 중 오류가 발생했습니다.');
    }
  };

  const handleCalendarClick = useCallback(() => {
    // 달력을 열 때 항상 오늘이 속한 연/월로 이동
    const now = new Date();
    setCalendarYear(now.getFullYear());
    setCalendarMonth(now.getMonth() + 1);
    setIsCalendarModalOpen(true);
  }, []);

  const handleCalendarClose = useCallback(() => {
    setIsCalendarModalOpen(false);
  }, []);

  const handleCalendarFlightClick = useCallback((flight: Flight) => {
    // 달력은 닫지 않고 FlightDetailModal만 표시
    // 최신 데이터를 위해 flights 배열에서 해당 비행편을 찾아서 전달
    const latestFlight = flights.find(f => f.id === flight.id) || flight;
    setSelectedFlight(latestFlight);
  }, [flights]);

  const handleCalendarMonthChange = useCallback((year: number, month: number) => {
    setCalendarYear(year);
    setCalendarMonth(month);
  }, []);

  const handleMonthClick = useCallback((month: number, year: number, monthFlights?: Flight[]) => {
    // 해당 월의 비행 데이터 필터링 (monthFlights가 제공되지 않은 경우에만)
    const flightsToUse = monthFlights || flights.filter(flight => {
      const flightDate = new Date(flight.date);
      return flightDate.getMonth() === month && flightDate.getFullYear() === year;
    });

    // BlockTimeCard와 동일한 getDutyTime 로직
    const getDutyTime = (monthFlights: Flight[]): string => {
      if (monthFlights.length === 0) {
        return '00:00';
      }

      // monthlyTotalBlock 사용
      const firstFlightWithMonthlyTotal = monthFlights.find(flight =>
        flight.monthlyTotalBlock && flight.monthlyTotalBlock !== '00:00'
      );
      if (firstFlightWithMonthlyTotal) {
        // monthlyTotalBlock이 이미 HH:MM 형식으로 저장됨
        return firstFlightWithMonthlyTotal.monthlyTotalBlock;
      }

      // monthlyTotalBlock이 없으면 개별 비행의 block 시간을 합산
      const totalBlockMinutes = monthFlights.reduce((total, flight) => {
        if (flight.block && flight.block > 0) {
          return total + flight.block;
        }
        return total;
      }, 0);

      if (totalBlockMinutes > 0) {
        const hours = Math.floor(totalBlockMinutes / 60);
        const minutes = totalBlockMinutes % 60;
        return (String(hours).padStart(2, '0')) + ':' + (String(minutes).padStart(2, '0'));
      }

      // 모든 방법이 실패하면 00:00 반환
      return '00:00';
    };

    // block 시간 계산
    const blockTime = getDutyTime(flightsToUse);
    setMonthlyModalData({ month, year, flights: flightsToUse, blockTime });
  }, [flights]);

  // 월별 스케줄 모달에서 월 변경 핸들러
  const handleMonthlyModalMonthChange = (month: number, year: number) => {
    handleMonthClick(month, year);
  };

  const handleCurrencyCardClick = (type: 'takeoff' | 'landing', currencyInfo: CurrencyInfo) => {
    // recentEvents의 ID를 사용해서 원본 flights 배열에서 완전한 Flight 객체들을 찾기
    const completeFlights = currencyInfo.recentEvents.map(event => {
      const originalFlight = flights.find(f => f.id === event.id);
      return originalFlight || event; // 원본을 찾지 못하면 기존 이벤트 사용
    });

    // 6개월 데이터 계산 (그래프용)
    const todayStr = new Date().toLocaleDateString('en-CA');
    const KOREA_TIME_ZONE = 'Asia/Seoul';

    const today = toZonedTime((todayStr) + 'T00:00:00', KOREA_TIME_ZONE);
    const sixMonthsAgo = toZonedTime((todayStr) + 'T00:00:00', KOREA_TIME_ZONE);
    sixMonthsAgo.setMonth(today.getMonth() - 6);

    const sixMonthFlights = flights.filter(f => {
      try {
        const flightDate = toZonedTime((f.date) + 'T00:00:00', KOREA_TIME_ZONE);
        return flightDate >= sixMonthsAgo && flightDate <= today;
      } catch (error) {
        return false;
      }
    });

    const graphEvents = sixMonthFlights.filter(f =>
      type === 'takeoff' ? f.status.departed : f.status.landed
    );



    setCurrencyModalData({
      title: type === 'takeoff' ? '이륙' : '착륙',
      events: completeFlights,
      graphEvents: graphEvents // 그래프용 6개월 데이터 추가
    });
  };

  const handleCurrencyFlightClick = (flight: Flight) => {
    setCurrencyModalData(null);
    // 최신 데이터를 위해 flights 배열에서 해당 비행편을 찾아서 전달
    const latestFlight = flights.find(f => f.id === flight.id) || flight;
    setSelectedFlight(latestFlight);
  };

  const handleCrewMemberClick = (crewName: string, empl?: string, crewType?: 'flight' | 'cabin') => {

    // 승무원 타입에 따라 다른 필터링 로직 적용
    const flightsWithCrew = flights.filter(f => {
      if (crewType === 'cabin') {
        // 캐빈 승무원인 경우
        return f.cabinCrew && f.cabinCrew.some(member => member.name === crewName);
      } else {
        // 일반 승무원인 경우 (기존 로직)
        return f.crew && f.crew.some(member => member.name === crewName && (!empl || member.empl === empl));
      }
    });


    setSelectedCrewName(crewName);
    setFlightsWithSelectedCrew(flightsWithCrew);
    setSelectedCrewType(crewType || 'flight');
    setIsCrewHistoryModalOpen(true);
  };

  const handleCrewHistoryModalClose = () => {
    setIsCrewHistoryModalOpen(false);
    setSelectedCrewName('');
    setFlightsWithSelectedCrew([]);
    setSelectedCrewType('flight');
  };

  const handleCrewHistoryFlightClick = (flight: Flight) => {
    handleCrewHistoryModalClose();
    // 최신 데이터를 위해 flights 배열에서 해당 비행편을 찾아서 전달
    const latestFlight = flights.find(f => f.id === flight.id) || flight;
    setSelectedFlight(latestFlight);
  };

  const handleCrewMemoClick = (crewName: string) => {
    setSelectedCrewName(crewName);
    setIsCrewMemoModalOpen(true);
  };

  const handleCrewMemoSave = async (crewName: string, memo: string) => {
    try {
      if (!user?.uid) {
        throw new Error('사용자 인증이 필요합니다.');
      }


      // 로컬 상태 업데이트
      const updatedMemos = {
        ...crewMemos,
        [crewName]: memo
      };
      setCrewMemos(updatedMemos);

      // Firebase에 암호화된 메모 저장
      await saveCrewMemos(user.uid, updatedMemos);

    } catch (error) {
      console.error('메모 저장 실패:', error);
      throw error;
    }
  };

  const handleCrewMemoModalClose = () => {
    setIsCrewMemoModalOpen(false);
    setSelectedCrewName('');
  };

  const handleCityMemoClick = (cityCode: string) => {
    setSelectedCityForMemo(cityCode);
    setIsCityMemoModalOpen(true);
  };

  const handleCityMemoSave = async (cityCode: string, memo: string) => {
    try {
      const updatedCityMemos = { ...cityMemos, [cityCode]: memo };
      setCityMemos(updatedCityMemos);

      if (user) {
        await saveCityMemos(user.uid, updatedCityMemos);
      }
    } catch (error) {
      console.error('도시 메모 저장 실패:', error);
      throw error;
    }
  };

  const handleCityMemoModalClose = () => {
    setIsCityMemoModalOpen(false);
    setSelectedCityForMemo('');
  };

  const handleUserSettingsClick = () => {
    setIsUserSettingsModalOpen(true);
  };

  const handleUserSettingsClose = () => {
    setIsUserSettingsModalOpen(false);
  };

  // 사용자 설정 업데이트 핸들러
  const handleUserSettingsUpdate = async (userId: string, settings: any) => {
    try {
      await saveUserSettings(userId, settings);

      // 로컬 상태 즉시 업데이트
      if (settings.airline) {
        setSelectedAirline(settings.airline);
      }

      // 사용자 정보도 업데이트
      if (user?.uid === userId) {
        const updatedUserInfo = await getUserInfo(userId);
        if (updatedUserInfo) {
          setUserInfo({
            displayName: updatedUserInfo.displayName,
            empl: updatedUserInfo.empl,
            userName: updatedUserInfo.userName,
            company: updatedUserInfo.company
          });
        }
      }
    } catch (error) {
      console.error('사용자 설정 업데이트 오류:', error);
    }
  };

  const handleNoFlightModalClose = () => {
    setNoFlightModal({ isOpen: false, type: 'last' });
  };

  const handleAboutClick = () => {
    setIsAboutModalOpen(true);
  };

  const handleAboutClose = () => {
    setIsAboutModalOpen(false);
  };

  const handleCurrencySettingsClick = () => {
    setIsCurrencySettingsModalOpen(true);
  };

  const handleCurrencySettingsClose = () => {
    setIsCurrencySettingsModalOpen(false);
  };

  const handleCurrencyCardToggle = async (cardType: string) => {
    const newCards = selectedCurrencyCards.includes(cardType)
      ? selectedCurrencyCards.filter(card => card !== cardType)
      : [...selectedCurrencyCards, cardType];

    setSelectedCurrencyCards(newCards);

    // Firebase에 저장
    if (user?.uid) {
      try {
        await saveUserSettings(user.uid, { selectedCurrencyCards: newCards });
      } catch (error) {
        console.error('선택된 카드 저장 실패:', error);
      }
    }
  };

  const handleCurrencyCardReorder = async (fromIndex: number, toIndex: number) => {
    const newCards = [...selectedCurrencyCards];
    const [movedCard] = newCards.splice(fromIndex, 1);
    newCards.splice(toIndex, 0, movedCard);

    setSelectedCurrencyCards(newCards);

    // Firebase에 저장
    if (user?.uid) {
      try {
        await saveUserSettings(user.uid, { selectedCurrencyCards: newCards });
      } catch (error) {
        console.error('카드 순서 저장 실패:', error);
      }
    }
  };

  // 여권/비자 경고 팝업 관련 핸들러들
  const handlePassportVisaWarningClose = () => {
    setIsPassportVisaWarningOpen(false);
  };

  const handlePassportVisaWarningDismiss = () => {
    dismissWarningForWeek();
    setIsPassportVisaWarningOpen(false);
  };

  const checkPassportVisaWarnings = () => {
    // 1주일간 팝업 금지 상태 확인
    if (isWarningDismissed()) {
      return;
    }

    // 샘플 데이터로 경고 계산 (실제로는 사용자 설정에서 가져와야 함)
    const sampleData = getSamplePassportVisaData();
    const warnings = calculateWarnings(sampleData);

    if (warnings.length > 0) {
      setPassportVisaWarnings(warnings);
      setIsPassportVisaWarningOpen(true);
    }
  };

  // 만기 날짜 관련 핸들러들
  const handleCardClick = (cardType: string, cardName: string) => {
    // 이륙/착륙 카드는 클릭해도 만기 날짜 입력 팝업을 표시하지 않음
    if (cardType === 'takeoff' || cardType === 'landing') {
      return;
    }

    setSelectedCardForExpiry({ type: cardType, name: cardName });
    setIsExpiryDateModalOpen(true);
  };

  const handleExpiryDateSave = async (expiryDate: string) => {
    if (selectedCardForExpiry && user) {
      const updatedExpiryDates = {
        ...cardExpiryDates,
        [selectedCardForExpiry.type]: expiryDate
      };

      // 로컬 상태 업데이트
      setCardExpiryDates(updatedExpiryDates);

      // Firebase에 저장
      try {
        await saveDocumentExpiryDates(user.uid, updatedExpiryDates);
      } catch (error) {
        console.error('문서 만료일 Firebase 저장 실패:', error);
      }
    }
  };

  const handleExpiryDateModalClose = () => {
    setIsExpiryDateModalOpen(false);
    setSelectedCardForExpiry(null);
  };

  // 연간 비행시간 그래프 모달 핸들러
  const handleAnnualBlockTimeGraphClick = () => {
    setIsAnnualBlockTimeModalOpen(true);
  };

  const handleAnnualBlockTimeModalClose = () => {
    setIsAnnualBlockTimeModalOpen(false);
  };

  const handleConflictModalClose = () => {
    setShowConflictModal(false);
    setConflicts([]);
  };

  const handleConflictResolution = (resolutions: any) => {
    setShowConflictModal(false);
    setConflicts([]);
  };

  // 공항 클릭 핸들러
  const handleAirportClick = (airportCode: string) => {
    setSelectedCityForSchedule(airportCode);
    setIsCityScheduleModalOpen(true);
  };



  // 스케줄 수정 핸들러
  const handleEditFlight = async (flight: Flight) => {
    try {

      if (!user) {
        throw new Error('사용자가 로그인되지 않았습니다.');
      }


      // _storagePath 정보가 있으면 사용, 없으면 날짜 기반으로 경로 구성
      let flightPath;
      let year, month;

      if (flight._storagePath) {
        // _storagePath 정보를 사용해서 정확한 경로 구성
        year = flight._storagePath.year;
        month = flight._storagePath.month;
        flightPath = 'users/' + (user.uid) + '/flights/' + (year) + '/' + (month) + '/' + (flight._storagePath.firebaseKey);
      } else {
        // 기존 방식: 날짜에서 년/월 추출
        const flightDate = new Date(flight.date);
        year = flightDate.getFullYear();
        month = (flightDate.getMonth() + 1).toString().padStart(2, '0');
        flightPath = 'users/' + (user.uid) + '/flights/' + (year) + '/' + (month) + '/' + (flight.id);
      }

      // Firebase에 업데이트 (Mutation 사용)
      await updateFlightMutation.mutateAsync({
        flightId: flight.id,
        dataToUpdate: flight,
        userId: user.uid
      });

      // 로컬 상태 업데이트는 Query Invalidation으로 자동 처리됨

      // selectedFlight도 업데이트 (현재 열린 모달의 데이터 동기화)
      setSelectedFlight(prevSelected =>
        prevSelected && prevSelected.id === flight.id
          ? { ...flight, _storagePath: { year, month, firebaseKey: flight._storagePath?.firebaseKey || flight.id.toString() } }
          : prevSelected
      );


    } catch (error) {
      alert('수정 중 오류가 발생했습니다: ' + (error.message));
    }
  };

  // 스케줄 삭제 핸들러
  const handleDeleteFlight = async (flightId: number) => {
    if (!user) return;
    const flight = flights.find(f => f.id === flightId);
    if (!flight) {
      alert('삭제할 비행편을 찾을 수 없습니다.');
      return;
    }

    try {
      // Firebase에서 삭제 (Mutation 사용)
      if (flight._storagePath) {
        await deleteFlightMutation.mutateAsync({
          flightId: String(flightId),
          storagePath: flight._storagePath,
          userId: user.uid
        });
      } else {
        // _storagePath가 없는 경우 (예외 처리)
        // 기존 방식: 날짜에서 년/월 추출
        const flightDate = new Date(flight.date);
        const year = flightDate.getFullYear().toString();
        const month = (flightDate.getMonth() + 1).toString().padStart(2, '0'); // 문자열로 변환

        await deleteFlightMutation.mutateAsync({
          flightId: String(flightId),
          storagePath: { year, month, firebaseKey: String(flightId) }, // firebaseKey가 정확하지 않을 수 있음 주의
          userId: user.uid
        });
      }

      // 로컬 상태 업데이트는 Query Invalidation으로 자동 처리됨

      // selectedFlight이 삭제된 항목이면 초기화
      if (selectedFlight && selectedFlight.id === flightId) {
        setSelectedFlight(null);
        setSelectedFlightType(undefined);
      }

      // monthlyModalData도 업데이트 (월 스케줄 모달이 열려있는 경우)
      if (monthlyModalData && monthlyModalData.flights.some(f => f.id === flightId)) {
        setMonthlyModalData(prevData => {
          if (!prevData) return prevData;
          const updatedFlights = prevData.flights.filter(f => f.id !== flightId);

          // BlockTime 재계산
          const getDutyTime = (monthFlights: Flight[]): string => {
            if (monthFlights.length === 0) {
              return '00:00';
            }

            // monthlyTotalBlock 사용
            const firstFlightWithMonthlyTotal = monthFlights.find(flight =>
              flight.monthlyTotalBlock && flight.monthlyTotalBlock !== '00:00'
            );
            if (firstFlightWithMonthlyTotal) {
              return firstFlightWithMonthlyTotal.monthlyTotalBlock;
            }

            // monthlyTotalBlock이 없으면 개별 비행의 block 시간을 합산
            const totalBlockMinutes = monthFlights.reduce((total, flight) => {
              if (flight.block && flight.block > 0) {
                return total + flight.block;
              }
              return total;
            }, 0);

            if (totalBlockMinutes > 0) {
              const hours = Math.floor(totalBlockMinutes / 60);
              const minutes = totalBlockMinutes % 60;
              return (String(hours).padStart(2, '0')) + ':' + (String(minutes).padStart(2, '0'));
            }

            return '00:00';
          };

          const newBlockTime = getDutyTime(updatedFlights);

          return {
            ...prevData,
            flights: updatedFlights,
            blockTime: newBlockTime
          };
        });
      }


    } catch (error) {
      console.error('❌ 비행편 삭제 실패:', error);
      throw error;
    }
  };

  // 날짜 표시 함수
  const getTodayDisplay = () => {
    const today = new Date();
    const datePart = today.toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Seoul'
    });
    const weekdayPart = today.toLocaleDateString('ko-KR', {
      weekday: 'long',
      timeZone: 'Asia/Seoul'
    });
    return { datePart, weekdayPart };
  };

  const { datePart: todayDatePart, weekdayPart: todayWeekdayPart } = getTodayDisplay();
  const todayStr = getTodayString();
  const { lastFlight, nextFlight, nextNextFlight } = findLastAndNextFlights(flights, todayStr);

  // nextNextFlight가 비어있을 때, nextFlight 바로 다음 스케줄을 동적으로 보정
  const computedNextNextFlight = useMemo(() => {
    if (nextNextFlight) return nextNextFlight;
    if (!nextFlight) return undefined;

    const specialSchedules = [
      'FIXED SKD', 'STANDBY', 'DAY OFF', 'A STBY', 'B STBY', 'G/S STUDENT', 'GS STUDENT', 'G/S', 'GS', 'GROUND SCHOOL', 'R_SIM1', 'R_SIM2', 'RESERVE', 'OTHRDUTY', 'RDO', 'ALV', 'ALM', 'ANNUAL LEAVE', 'VAC_R', 'VAC', 'SIM', 'MEDICAL CHK', 'MEDICAL', '안전회의', 'SAFETY', 'TRAINING', '교육', 'BRIEFING', '브리핑', 'MEETING', '회의', 'CHECK', '점검', 'INSPECTION', '검사'
    ];
    const isActual = (f: any): boolean => {
      const num = (f?.airlineFlightNumber || f?.flightNumber || '').toString();
      if (!num) return false;
      const upper = num.toUpperCase();
      if (specialSchedules.includes(upper)) return false;
      return !!(f?.route && String(f.route).trim() !== '');
    };

    const getDepartureTimestamp = (f: any): number | null => {
      try {
        if (f?.departureDateTimeUtc) {
          return new Date(f.departureDateTimeUtc).getTime();
        }
        if (f?.date) {
          // std가 있으면 함께 사용, 없으면 자정 기준
          if ((f as any).std && typeof (f as any).std === 'string') {
            const [hh, mm] = (f as any).std.split(':').map((v: string) => parseInt(v, 10));
            const hhStr = String(isFinite(hh) ? hh : 0).padStart(2, '0');
            const mmStr = String(isFinite(mm) ? mm : 0).padStart(2, '0');
            return new Date((f.date) + 'T' + (hhStr) + ':' + (mmStr) + ':00Z').getTime();
          }
          return new Date((f.date) + 'T00:00:00Z').getTime();
        }
      } catch { }
      return null;
    };

    const refTs = getDepartureTimestamp(nextFlight);
    if (!refTs) return undefined;

    const candidates = flights
      .filter((f) => isActual(f))
      .map((f) => ({ f, ts: getDepartureTimestamp(f) }))
      .filter((x) => typeof x.ts === 'number' && (x.ts as number) > refTs)
      .sort((a, b) => (a.ts as number) - (b.ts as number));

    if (candidates.length > 0) return candidates[0].f;

    // 2) 체이닝 규칙: 다음비행의 도착공항을 출발지로 갖는 스케줄을 우선 사용
    const arrivalCode = (nextFlight.route || '').split('/')[1] || '';
    if (arrivalCode) {
      const chain = flights
        .filter((f) => isActual(f) && typeof f.route === 'string' && f.route.toUpperCase().startsWith((arrivalCode.toUpperCase()) + '/'))
        .map((f) => ({ f, ts: getDepartureTimestamp(f) }))
        .sort((a, b) => (a.ts || 0) - (b.ts || 0));
      if (chain.length > 0) return chain[0].f;
    }

    // 3) 마지막 수단: 화면에 먼저 보여주기 위한 placeholder 생성 (계산 부정확해도 OK)
    const dep = arrivalCode || (nextFlight.route || '').split('/')[0] || 'ICN';
    const placeholder: any = {
      id: -1000,
      date: nextFlight.date,
      flightNumber: 'NEXT_CHAIN',
      route: (dep) + '/???',
      block: 0,
      status: { departed: false, landed: false },
      crew: []
    };
    return placeholder;
  }, [nextNextFlight, nextFlight, flights]);

  // 카드 슬라이더 상태
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);

  // 슬라이더 컨테이너 실제 폭 측정 (항상 두 장만 보이도록 픽셀 기반 계산)
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const [sliderContainerWidth, setSliderContainerWidth] = useState(0);

  useEffect(() => {
    const el = sliderContainerRef.current;
    if (!el) return;

    const updateWidth = () => {
      setSliderContainerWidth(el.clientWidth);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(() => updateWidth());
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

  // gap-6 = 24px (Tailwind 기본 16px 기준)
  const GAP_PX = 24;

  // 반응형 카드 너비 계산 - BlockTimeCard의 grid-cols-2와 정확히 일치하도록 수정
  // BlockTimeCard는 내부적으로 gap-6을 사용하므로, 여기서도 동일한 gap을 고려해야 함
  const isMobile = sliderContainerWidth < 640; // Tailwind sm breakpoint
  const visibleCardCount = isMobile ? 1 : 2;

  // 그리드 레이아웃과 정확히 일치하는 너비 계산
  // 전체 너비에서 gap을 뺀 후 카드 개수로 나눔
  const cardItemWidth = Math.max(0, (sliderContainerWidth - (GAP_PX * (visibleCardCount - 1))) / visibleCardCount);
  // 소수점 처리를 위해 floor 사용 (round는 미세한 오차로 줄바꿈 발생 가능)
  const roundedItemWidth = Math.floor(cardItemWidth);
  const sliderOffsetPx = currentCardIndex * (roundedItemWidth + GAP_PX);

  // 카드 데이터 배열 (항상 2개씩 표시)
  const cardData = useMemo(() => {
    const cards = [];

    // 최근 비행 카드
    cards.push({ flight: lastFlight, type: 'last' as const, title: '최근 비행', color: 'green' });

    // 다음 비행 카드
    cards.push({ flight: nextFlight, type: 'next' as const, title: '다음 비행', color: 'blue' });

    // 그 다음 비행 카드 (항상 추가 - 계산이 없어도 nextFlight로 대체)
    const nextNext = computedNextNextFlight || nextFlight || undefined;
    if (nextNext) {
      cards.push({ flight: nextNext, type: 'nextNext' as const, title: '그 다음 비행', color: 'purple' });
    }

    return cards;
  }, [lastFlight, nextFlight, computedNextNextFlight]);

  // 초기 표시: 최근 비행 + 다음 비행이 기본
  useEffect(() => {
    if (currentCardIndex !== 0) setCurrentCardIndex(0);
  }, [cardData.length]);

  // 현재 표시할 카드 2개
  const visibleCards = useMemo(() => {
    return cardData.slice(currentCardIndex, currentCardIndex + 2);
  }, [cardData, currentCardIndex]);

  // 스와이프 핸들러
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;

    const distance = touchStartX - touchEndX;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentCardIndex < cardData.length - visibleCardCount) {
      setCurrentCardIndex(prev => prev + 1);
    }
    if (isRightSwipe && currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
    }
  };

  // Web Worker를 사용한 currency 계산 (성능 최적화)
  const [currencyData, setCurrencyData] = useState<{
    takeoff: any;
    landing: any;
  } | null>(null);

  useEffect(() => {
    // Web Worker를 일시적으로 비활성화하고 fallback 함수만 사용
    if (flights.length > 0) {
      const takeoffCurrency = calculateCurrency(flights, 'takeoff', todayStr);
      const landingCurrency = calculateCurrency(flights, 'landing', todayStr);
      setCurrencyData({
        takeoff: takeoffCurrency,
        landing: landingCurrency
      });
    } else {
      // flights가 비어있으면 currencyData 초기화
      setCurrencyData(null);
    }
  }, [flights, todayStr]);

  // Fallback values while loading - 중복 계산 방지
  const takeoffCurrency = currencyData?.takeoff;
  const landingCurrency = currencyData?.landing;

  // 로딩 화면
  if (isLoading) {
    return (
      <div className="min-h-screen transition-colors duration-200 p-4 sm:p-6 pb-24 sm:pb-24 pt-safe pl-safe pr-safe pb-safe flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto"></div>
          <p className="text-xl font-semibold text-gray-700 dark:text-gray-300 mt-4">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // ✨ [핵심 수정] 카카오 로그인 콜백 URL 우선 처리 (로그인/로그아웃 무관)
  if (new URLSearchParams(window.location.search).has('code') || new URLSearchParams(window.location.search).has('error')) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 font-sans">
        <Suspense fallback={<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mt-20"></div>}>
          <KakaoCallback
            onSuccess={() => console.log('카카오 로그인 및 데이터 마이그레이션 성공')}
            onError={(err) => setLoginError(err)}
          />
        </Suspense>
      </div>
    );
  }


  // ✨ [핵심 수정] 로그인 여부에 따라 명확하게 화면을 분기합니다.
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 font-sans">
      {!user ? (
        // ---------- 1. 로그인하지 않았을 때의 화면 ----------
        <div className="container mx-auto p-4 md:p-6 lg:p-8 flex flex-col items-center justify-center min-h-screen">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 leading-tight mb-4">
              My<br />KneeBoard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              나의 비행 정보를 한번에!
            </p>
          </div>

          {new URLSearchParams(window.location.search).has('code') || new URLSearchParams(window.location.search).has('error') ? (
            <Suspense fallback={<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>}>
              <KakaoCallback
                onSuccess={() => console.log('카카오 로그인 성공')}
                onError={(err) => setLoginError(err)}
              />
            </Suspense>
          ) : (
            <div className="glass-panel rounded-2xl p-8 w-full max-w-md">
              <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200 text-center mb-6">
                로그인
              </h2>

              {/* 카카오 로그인 버튼 */}
              <button
                onClick={() => {
                  const REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY;
                  if (!REST_API_KEY) {
                    alert('카카오 REST API 키가 설정되지 않았습니다. (.env.local 확인 필요)');
                    return;
                  }

                  // 로그인 상태라면 마이그레이션을 위해 UID 백업
                  if (auth.currentUser) {
                    localStorage.setItem('migration_old_uid', auth.currentUser.uid);
                  } else {
                    // 비로그인 상태에서의 카카오 시작은 무조건 "신규 계정" 또는 단독 로그인이므로 백업된 UID를 안전하게 지움
                    localStorage.removeItem('migration_old_uid');
                  }

                  const REDIRECT_URI = window.location.origin + '/auth/kakao/callback';
                  const KAKAO_AUTH_URL = `https://kauth.kakao.com/oauth/authorize?client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=friends`;
                  window.location.href = KAKAO_AUTH_URL;
                }}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl font-medium text-lg mb-4"
                style={{
                  backgroundColor: '#FEE500',
                  color: '#000000',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 3C6.47715 3 2 6.58172 2 11C2 13.8443 3.49653 16.34 5.76011 17.8444L4.85106 21.0567C4.77382 21.3298 5.06173 21.5645 5.31175 21.4395L8.72917 19.7303C9.76174 19.9079 10.8522 20 12 20C17.5228 20 22 16.4183 22 12C22 7.58172 17.5228 4 12 4V3Z" fill="#000000" />
                </svg>
                카카오로 시작하기
              </button>

              <div className="relative flex py-5 items-center">
                <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">또는 기존 계정</span>
                <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
              </div>

              <button
                onClick={handleLoginClick}
                className="w-full glass-button py-3 px-4 rounded-2xl font-medium text-lg"
                style={{
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  borderRadius: '1rem',
                  overflow: 'hidden',
                  WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                  maskImage: '-webkit-radial-gradient(white, black)'
                }}
              >
                이메일로 로그인하기
              </button>
            </div>
          )}

          <footer className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex justify-center items-center gap-4">
              <p>My KneeBoard © 2026. v{DISPLAY_VERSION}</p>
              <button
                onClick={handleAboutClick}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
              >
                정보
              </button>
            </div>
          </footer>
        </div>
      ) : (
        // ---------- 2. 로그인했을 때의 대시보드 화면 ----------
        <div className="container mx-auto p-4 md:p-6 lg:p-8 flex flex-col relative">
          {/* React 18 Concurrent Loading Indicator */}
          {isPending && (
            <div className="fixed top-4 right-4 z-50 bg-blue-500 text-white px-3 py-1 rounded-full text-sm shadow-lg animate-pulse">
              업데이트 중...
            </div>
          )}
          {/* 오프라인 배너 */}
          {isOffline && (
            <div className="bg-orange-500 text-white text-center py-2 px-4 mb-4 rounded-lg shadow-md">
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">📡</span>
                <span className="font-medium">오프라인 모드</span>
                <span className="text-sm opacity-90">- 로컬 데이터만 사용 가능</span>
                {syncStatus.pendingCount > 0 && (
                  <span className="text-sm bg-white bg-opacity-20 px-2 py-1 rounded">
                    {syncStatus.pendingCount}개 작업 대기 중
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 헤더 */}
          <header className="mb-4 grid grid-cols-3 items-center gap-2 sm:gap-4">
            {/* Left: User Info */}
            <div className="flex flex-col items-start gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-gray-700 dark:text-gray-300 truncate">
                  {user.displayName}님
                </span>
                <div className="bg-transparent flex-shrink-0">
                  <AirlineLogo airline={selectedAirline} className="w-6 h-6" />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleUserSettingsClick}
                  className="relative text-xs px-1.5 py-0.5 rounded hover:bg-gray-600 transition-colors group"
                  title="설정"
                >
                  <div className="absolute inset-0 bg-gray-500 rounded group-hover:bg-gray-600 transition-colors" />
                  <span className="relative z-10 text-white">설정</span>
                </button>
                {isUserAdmin && (
                  <button
                    onClick={handleJsonUploadClick}
                    disabled={isUploading || isOffline}
                    className="relative text-xs px-1.5 py-0.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-auto group"
                    title="관리자: 항공편 DB 업로드"
                  >
                    <div className="absolute inset-0 bg-purple-500 rounded group-hover:bg-purple-600 transition-colors" />
                    <span className="relative z-10 text-white text-center leading-none block">
                      <span className="sm:hidden">DB<br />관리</span>
                      <span className="hidden sm:inline">DB관리</span>
                    </span>
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="relative text-xs px-1.5 py-0.5 rounded hover:bg-red-600 transition-colors h-auto group"
                  title="로그아웃"
                >
                  <div className="absolute inset-0 bg-red-500 rounded group-hover:bg-red-600 transition-colors" />
                  <span className="relative z-10 text-white text-center leading-none block">
                    <span className="sm:hidden">로그<br />아웃</span>
                    <span className="hidden sm:inline">로그아웃</span>
                  </span>
                </button>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {utcTime}
              </div>
            </div>

            {/* Center: Title */}
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                My<br />KneeBoard
              </h1>
            </div>

            {/* Right: Upload Icon & Date */}
            <div className="flex flex-col items-end min-w-0">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept={getAllowedFileTypes(userInfo?.company || 'OZ')}
              />
              <input
                type="file"
                ref={jsonFileInputRef}
                onChange={handleJsonFileChange}
                className="hidden"
                accept=".json"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleHardRefresh}
                  disabled={isRefreshing || isOffline}
                  title={isOffline ? "오프라인 상태에서는 새로고침할 수 없습니다" : "Clear Cache & Hard Refresh"}
                  className="p-1.5 rounded-full text-gray-600 dark:text-gray-400 hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <RefreshCwIcon className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setIsDeleteDataModalOpen(true)}
                  disabled={isLoading || flights.length === 0 || !user}
                  title="Delete Month Data"
                  className="p-1.5 rounded-full text-gray-600 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <TrashIcon className="w-6 h-6" />
                </button>
                <button
                  onClick={handleUploadClick}
                  disabled={isUploading}
                  title={
                    userInfo?.company === '7C'
                      ? "PDF 스케줄 업로드"
                      : userInfo?.company === 'KE' || userInfo?.company === 'OZ'
                        ? "Excel 스케줄 업로드"
                        : "스케줄 파일 업로드"
                  }
                  className="p-1.5 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UploadCloudIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 text-right">
                <p>{todayDatePart}</p>
                <p>{todayWeekdayPart}(KST) 기준</p>
              </div>
            </div>
          </header>

          {/* 새로고침 팝업 메시지 */}
          {refreshMessage && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-popup-in">
              <div className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
                <RefreshCwIcon className="w-5 h-5 animate-clock-rotation" />
                <span className="font-medium">{refreshMessage}</span>
              </div>
            </div>
          )}

          {/* 업로드 메시지 */}
          {uploadMessage && (
            <div className="bg-green-500 text-white text-center py-2 px-4 mb-4 rounded">
              {uploadMessage}
            </div>
          )}

          {uploadError && (
            <div className="bg-red-500 text-white text-center py-2 px-4 mb-4 rounded">
              {uploadError}
            </div>
          )}

          {/* 탭 네비게이션 */}
          <div className="w-full max-w-screen-xl mx-auto">
            <div className="glass-panel rounded-2xl p-1 mb-6 flex justify-between items-center sticky top-4 z-30">
              <div className="flex space-x-1 w-full">
                {['dashboard', 'friends', 'rest', 'flightData'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab as any)}
                    className={`relative flex-1 py-2 px-3 md:py-3 md:px-4 rounded-xl text-sm font-medium transition-colors duration-200 z-10 ${activeTab === tab
                      ? 'text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                      } `}
                  >
                    {activeTab === tab && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/30 -z-10"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                    {tab === 'dashboard' ? '대시보드' : tab === 'rest' ? '휴식 계산' : tab === 'flightData' ? '비행 데이터' : '친구'}
                  </button>
                ))}
              </div>
            </div>

            {/* 탭 내용 */}
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <section className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-300">월별 비행 시간 (Block)</h2>
                        <button
                          onClick={handleAnnualBlockTimeGraphClick}
                          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                          title="연간 비행시간 그래프"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsSearchModalOpen(true)}
                          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                          title="CREW 검색 / 도시 검색"
                        >
                          <SearchIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={handleCalendarClick}
                          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                          title="전체 달력 보기"
                        >
                          <CalendarIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* BlockTimeCard는 내부적으로 grid-cols-2를 사용하므로 외부 그리드 제거하여 너비 일치시킴 */}
                    <div className="w-full">
                      <BlockTimeCard
                        flights={flights}
                        todayStr={todayStr}
                        onMonthClick={handleMonthClick}
                      />
                    </div>
                  </section>

                  <section className="mb-1">
                    <div
                      className="relative overflow-hidden"
                      ref={sliderContainerRef}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    >
                      <div
                        className="flex flex-nowrap gap-6 transition-transform duration-300 ease-in-out"
                        style={{
                          transform: cardItemWidth > 0
                            ? 'translateX(0px)'
                            : 'translateX(0%)',
                          willChange: 'transform'
                        }}
                      >
                        {cardData.map((card, index) => (
                          <div
                            key={index}
                            className="flex-shrink-0"
                            style={{ width: cardItemWidth > 0 ? '100px' : 'calc((100% - 24px)/2)' }}
                          >
                            <FlightCard
                              flight={card.flight}
                              type={card.type}
                              onClick={handleFlightCardClick}
                              todayStr={todayStr}
                              onStatusChange={handleStatusChange}
                              baseIata={baseIata}
                            />
                          </div>
                        ))}
                      </div>

                      {/* 스와이프 인디케이터 */}
                      {cardData.length > 2 && (
                        <div className="flex justify-center mt-4 space-x-2">
                          {Array.from({ length: cardData.length - 1 }, (_, i) => (
                            <button
                              key={i}
                              onClick={() => setCurrentCardIndex(i)}
                              className="w-2 h-2 rounded-full transition-colors duration-200"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-300">자격 현황</h2>
                        <button
                          onClick={handleCurrencySettingsClick}
                          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                          title="자격 현황 설정"
                        >
                          <SettingsIcon className="w-5 h-5" />
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          setIsCurrencyExpanded(!isCurrencyExpanded);
                        }}
                        className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                        title={isCurrencyExpanded ? "추가 카드 접기" : "추가 카드 펼치기"}
                      >
                        {isCurrencyExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <CurrencyCard title="이륙" currencyInfo={takeoffCurrency} onClick={() => handleCurrencyCardClick('takeoff', takeoffCurrency)} />
                      <CurrencyCard title="착륙" currencyInfo={landingCurrency} onClick={() => handleCurrencyCardClick('landing', landingCurrency)} />
                      {selectedCurrencyCards.map((cardType) => {
                        // 임시 데이터 - 실제로는 각 카드 타입에 맞는 데이터를 가져와야 함
                        // 임시 데이터 - 실제로는 각 카드 타입에 맞는 데이터를 가져와야 함
                        const tempCurrencyInfo: CurrencyInfo = {
                          count: 0,
                          isCurrent: false,
                          expiryDate: null,
                          daysUntilExpiry: null,
                          recentEvents: []
                        };

                        const cardNames: { [key: string]: string } = {
                          'passport': '여권',
                          'visa': '비자',
                          'epta': 'EPTA',
                          'radio': 'Radio',
                          'whitecard': 'White Card',
                          'crm': 'CRM'
                        };

                        // 카드가 긴급한지 확인
                        const expiryDate = cardExpiryDates[cardType];
                        let isUrgent = false;
                        if (expiryDate) {
                          const today = new Date();
                          const expiry = new Date(expiryDate);
                          const timeDiff = expiry.getTime() - today.getTime();
                          const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));

                          // White Card는 30일 이하, 다른 카드는 90일 이하
                          if (cardType === 'whitecard') {
                            isUrgent = daysUntilExpiry <= 30;
                          } else {
                            isUrgent = daysUntilExpiry <= 90;
                          }
                        }

                        // 긴급한 카드는 항상 표시, 일반 카드는 접기 상태에 따라 표시
                        const shouldShow = isUrgent || isCurrencyExpanded;
                        if (!shouldShow) return null;

                        return (
                          <CurrencyCard
                            key={cardType}
                            title={cardNames[cardType] || cardType}
                            currencyInfo={tempCurrencyInfo}
                            cardType={cardType}
                            expiryDate={cardExpiryDates[cardType]}
                            onClick={() => handleCardClick(cardType, cardNames[cardType] || cardType)}
                          />
                        );
                      })}
                    </div>
                  </section>
                </motion.div>
              )}

              {activeTab === 'friends' && (
                <motion.div
                  key="friends"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Suspense fallback={
                    <div className="text-center py-10 text-gray-400">
                      친구 목록을 불러오고 있습니다...
                    </div>
                  }>
                    <FriendsTab
                      user={user}
                      myFlights={flights}
                    />
                  </Suspense>
                </motion.div>
              )}

              {activeTab === 'rest' && (
                <motion.div
                  key="rest"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className={isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}
                >
                  <RestCalculator key={'rest-calculator - ' + theme} isDark={isDarkMode} />
                </motion.div>
              )}

              {activeTab === 'flightData' && (
                <motion.div
                  key="flightData"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className={(isDarkMode ? 'bg-gray-900' : 'bg-gray-100') + ' p-3 rounded-lg'}
                >
                  {/* Flight Data 섹션 */}
                  <section className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-300">Flight Data</h2>
                    </div>

                    {/* 검색 카드 그리드 */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {/* 항공편 검색 카드 */}
                      <div className="relative p-4 group">
                        <div className={'absolute inset-0 rounded-xl border shadow-sm transition-shadow ' + (isDarkMode
                          ? 'bg-gray-800 border-gray-700'
                          : 'bg-white border-gray-200 group-hover:shadow-md')}
                        />
                        <div className="relative z-10">
                          <div className="mb-3">
                            <div className="font-semibold text-gray-700 dark:text-gray-300">항공편 검색</div>
                          </div>
                          <div className="mb-3">
                            <input
                              type="text"
                              placeholder="예: OZ521"
                              value={flightSearchQuery}
                              onChange={(e) => setFlightSearchQuery(e.target.value.toUpperCase())}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !isLoadingFlightData) {
                                  handleFlightHistorySearch();
                                }
                              }}
                              className="w-full px-3 py-2 glass-input rounded-xl text-center font-mono text-lg focus:ring-2 focus:ring-blue-500/50 outline-none transition-all uppercase"
                              style={{
                                borderRadius: '12px',
                                overflow: 'hidden',
                                WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                                maskImage: '-webkit-radial-gradient(white, black)'
                              }}
                            />
                          </div>
                          <button
                            onClick={handleFlightHistorySearch}
                            disabled={isLoadingFlightData}
                            className={`w-full glass-button py-1.5 px-4 rounded-xl font-medium transition-all duration-200 ${isLoadingFlightData ? 'opacity-50 cursor-not-allowed' : ''}`}
                            style={{
                              WebkitAppearance: 'none',
                              appearance: 'none',
                              borderRadius: '0.75rem'
                            }}
                          >
                            {isLoadingFlightData ? '검색 중...' : '검색'}
                          </button>
                        </div>
                      </div>

                      {/* 항공사 정보 카드 */}
                      <div className="relative p-4 group">
                        <div className={'absolute inset-0 rounded-xl border shadow-sm transition-shadow ' + (isDarkMode
                          ? 'bg-gray-800 border-gray-700'
                          : 'bg-white border-gray-200 group-hover:shadow-md')}
                        />
                        <div className="relative z-10">
                          <div className="mb-3">
                            <div className="font-semibold text-gray-700 dark:text-gray-300">항공사 정보</div>
                          </div>
                          <div className="mb-3">
                            <input
                              type="text"
                              placeholder="예: OZ"
                              value={airlineSearchQuery}
                              onChange={(e) => setAirlineSearchQuery(e.target.value.toUpperCase())}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !isLoadingAirlineData) {
                                  handleAirlineSearch();
                                }
                              }}
                              className="w-full px-3 py-2 glass-input rounded-xl text-center font-mono text-lg focus:ring-2 focus:ring-blue-500/50 outline-none transition-all uppercase"
                              style={{
                                borderRadius: '12px',
                                overflow: 'hidden',
                                WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                                maskImage: '-webkit-radial-gradient(white, black)'
                              }}
                            />
                          </div>
                          <button
                            onClick={handleAirlineSearch}
                            disabled={isLoadingAirlineData}
                            className={`w-full glass-button py-1.5 px-4 rounded-xl font-medium transition-all duration-200 ${isLoadingAirlineData ? 'opacity-50 cursor-not-allowed' : ''}`}
                            style={{
                              WebkitAppearance: 'none',
                              appearance: 'none',
                              borderRadius: '0.75rem'
                            }}
                          >
                            {isLoadingAirlineData ? '로딩 중...' : '검색'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 항공편 검색 결과 섹션 */}
                    {showFlightResults && (
                      <div className="glass-panel rounded-xl p-4 mb-4 relative">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">항공편 검색 결과</h3>
                          <button
                            onClick={() => setShowFlightResults(false)}
                            className="p-1 text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100 transition-colors"
                            title="닫기"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        {/* 항공편 검색 결과 */}
                        {flightSearchResults.length > 0 ? (
                          <div className="mb-4">
                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                              총 {flightSearchResults.length}개의 항공편을 찾았습니다. 경로를 보려면 항목을 선택하세요.
                            </div>
                          </div>
                        ) : null}
                        {flightSearchResults.length > 0 ? (
                          flightSearchResults.map((flight, index) => (
                            <div key={index} className="glass-card p-4 rounded-xl hover:bg-white/5 transition-all duration-300 mb-3 border border-white/10">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <h4 className="text-lg font-bold text-gray-700 dark:text-gray-300">
                                    {(() => {
                                      const flightNumber = flight.flightNumber || '';
                                      // 항공편 번호에서 항공사 코드와 번호 분리 (예: 7C1301 -> 7C, 1301)
                                      const match = flightNumber.match(/^([A-Z0-9]+?)(\d+)$/);
                                      const iata = match ? match[1] : flightNumber;
                                      const number = match ? match[2] : '';
                                      const icao = flight.airlineCode ? getICAOCode(flight.airlineCode) : getICAOCode(flight.airline);
                                      return `${iata} ${number} (${icao} ${number})`;
                                    })()}
                                  </h4>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {getAirlineName(flight.airline || flight.airlineCode || '')}
                                  </div>
                                </div>
                                <span className="px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold rounded-full shadow-sm">
                                  {flight.type.includes('인천공항 API') ? '온라인' : flight.type}
                                </span>
                              </div>
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1 text-center">
                                  <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">출발</div>
                                  <div className="font-semibold text-gray-700 dark:text-gray-300 text-lg md:text-xl">{flight.origin || flight.departure}</div>
                                  <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                                    {getCityInfo(flight.origin || flight.departure)?.name || ''}
                                  </div>
                                  {/* 시간 표시 로직 개선 */}
                                  {(flight.planTime || flight.time || flight.scheduledTime) && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {flight.planTime
                                        ? flight.planTime
                                        : flight.time
                                          ? flight.time
                                          : !isNaN(new Date(flight.scheduledTime).getTime())
                                            ? new Date(flight.scheduledTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                                            : ''}
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 text-center">
                                  <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">도착</div>
                                  <div className="font-semibold text-gray-700 dark:text-gray-300 text-lg md:text-xl">{flight.destination || flight.arrival}</div>
                                  <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                                    {getCityInfo(flight.destination || flight.arrival)?.name || ''}
                                  </div>
                                  {flight.actualTime && (
                                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                                      실제: {new Date(flight.actualTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-2 text-sm">
                                {/* 기종 정보 (인천공항 API) */}
                                {(() => {
                                  // 일주일 데이터에서 모든 기종 추출
                                  if (flight.weeklyData && flight.type.includes('인천공항 API')) {
                                    const aircraftTypes = new Set<string>();

                                    Object.values(flight.weeklyData).forEach((dayFlights: any) => {
                                      if (Array.isArray(dayFlights)) {
                                        dayFlights.forEach((f: any) => {
                                          const aircraftModel = f.aircraft?.model || f.aircraft;
                                          if (aircraftModel && aircraftModel.trim()) {
                                            aircraftTypes.add(aircraftModel.trim());
                                          }
                                        });
                                      }
                                    });

                                    if (aircraftTypes.size > 0) {
                                      return (
                                        <div className="flex items-start space-x-2">
                                          <div className="w-2 h-2 bg-blue-400 rounded-full mt-1"></div>
                                          <div className="flex-1">
                                            <span className="text-gray-500 dark:text-gray-400">기종: </span>
                                            <span className="font-medium text-gray-700 dark:text-gray-300">
                                              {Array.from(aircraftTypes).map(type => simplifyAircraftType(type)).join(', ')}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    }
                                  }

                                  // 단일 기종 정보 (모든 기종 표시)
                                  if (flight.aircraft && flight.aircraft.trim()) {
                                    // 여러 기종이 콤마로 구분되어 있는 경우 모두 표시
                                    const aircraftTypes = flight.aircraft.split(',').map((type: string) => type.trim()).filter((type: string) => type);

                                    return (
                                      <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                        <span className="text-gray-500 dark:text-gray-400">기종:</span>
                                        <span className="font-medium text-gray-700 dark:text-gray-300">
                                          {aircraftTypes.map(type => simplifyAircraftType(type)).join(', ')}
                                        </span>
                                      </div>
                                    );
                                  }

                                  return null;
                                })()}


                                {/* 주간 스케줄 (인천공항 API의 weeklySchedule) */}
                                {flight.weeklySchedule && flight.type.includes('인천공항 API') && (
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                    <span className="text-gray-500 dark:text-gray-400">운항 요일:</span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                      {flight.weeklySchedule}
                                    </span>
                                  </div>
                                )}
                              </div>


                            </div>
                          ))
                        ) : (
                          <div className="glass-card p-6 rounded-lg text-center border border-white/10">
                            <p className={'text-sm ' + (isDarkMode ? 'text-gray-400' : 'text-gray-600')}>
                              {flightSearchQuery.trim() ?
                                '검색 결과가 없습니다.' :
                                '항공편명, 항공사, 출발지, 도착지를 입력하고 검색하세요.'
                              }
                            </p>
                          </div>
                        )}

                        {/* 주의사항 */}
                        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                          <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
                            주의 : 실제 정보와 다를 수 있습니다
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 항공사 정보 검색 결과 섹션 */}
                    {showAirlineResults && (
                      <div className="glass-panel rounded-xl p-4 relative">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">항공사 정보 검색 결과</h3>
                          <button
                            onClick={() => setShowAirlineResults(false)}
                            className="p-1 text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100 transition-colors"
                            title="닫기"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        {/* 항공사 정보 결과 */}
                        {airlineSearchResults.length > 0 ? (
                          airlineSearchResults.map((airline, index) => (
                            <div key={index} className="glass-card p-4 rounded-xl hover:bg-white/5 transition-all duration-300 mb-3 border border-white/10">
                              <div className="flex items-center justify-between mb-4">
                                <div>
                                  <h4 className="text-lg font-bold text-gray-700 dark:text-gray-300">{airline.name}</h4>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">{airline.koreanName}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg min-w-0">
                                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">IATA</div>
                                  <div className="font-bold text-gray-700 dark:text-gray-300 text-sm break-words">{airline.iata}</div>
                                </div>
                                <div className="text-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg min-w-0">
                                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">ICAO</div>
                                  <div className="font-bold text-gray-700 dark:text-gray-300 text-sm break-words">{airline.icao}</div>
                                </div>
                                <div className="text-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg min-w-0">
                                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">호출부호</div>
                                  <div className="font-bold text-gray-700 dark:text-gray-300 text-xs break-words leading-tight">{airline.callsign}</div>
                                </div>
                                <div className="text-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg min-w-0">
                                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">국가</div>
                                  <div className="font-bold text-gray-700 dark:text-gray-300 text-sm break-words flex items-center justify-center gap-1">
                                    <span>{getCountryFlag(airline.country)}</span>
                                    <span>{airline.country}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="glass-card p-6 rounded-lg text-center border border-white/10">
                            <p className={'text-sm ' + (isDarkMode ? 'text-gray-400' : 'text-gray-600')}>
                              {airlineSearchQuery.trim() ? '검색 결과가 없습니다.' : 'IATA/ICAO 코드, 항공사명, 호출부호로 검색하세요.'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                </motion.div>
              )}
            </AnimatePresence >

            <footer className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex justify-center items-center gap-4">
                <p>My KneeBoard © 2026. v{DISPLAY_VERSION}</p>
                <button
                  onClick={handleAboutClick}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                >
                  정보
                </button>
              </div>
            </footer>
          </div>


        </div >
      )
      }

      {/* ---------- 3. 모든 모달들은 공통으로 맨 마지막에 렌더링 ---------- */}
      <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>}>
        <FlightDetailModal
          flight={selectedFlight}
          onClose={() => {
            setSelectedFlight(null);
            setSelectedFlightType(undefined);
          }}
          onUpdateStatus={handleUpdateFlightStatus}
          onStatusChange={handleStatusChange}
          flightType={selectedFlightType}
          currentUser={userInfo}
          onCrewClick={handleCrewMemberClick}
          onMemoClick={handleCrewMemoClick}
          onAirportClick={handleAirportClick}
          onEditFlight={handleEditFlight}
          onDeleteFlight={handleDeleteFlight}
        />
      </Suspense>
      <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>}>
        <CurrencyDetailModal
          data={currencyModalData}
          onClose={() => setCurrencyModalData(null)}
          onFlightClick={handleCurrencyFlightClick}
        />
        <MonthlyScheduleModal
          data={monthlyModalData}
          onClose={() => setMonthlyModalData(null)}
          onFlightClick={(flight) => {
            // 최신 데이터를 위해 flights 배열에서 해당 비행편을 찾아서 전달
            const latestFlight = flights.find(f => f.id === flight.id) || flight;
            setSelectedFlight(latestFlight);
          }}
          onMonthChange={handleMonthlyModalMonthChange}
          onStatusChange={handleStatusChange}
          userInfo={userInfo}
        />

        {/* 친구 스케줄 모달 */}
        {friendModalData && (
          <MonthlyScheduleModal
            data={friendModalData}
            onClose={() => setFriendModalData(null)}
            onFlightClick={(flight) => {
              setSelectedFlight(flight);
              setSelectedFlightType('next');
            }}
            onMonthChange={() => { }} // 친구 모달에서는 월 전환 미구현 (간단하게)
            userInfo={friendUserInfo}
          />
        )}
        <CalendarModal
          isOpen={isCalendarModalOpen}
          onClose={handleCalendarClose}
          flights={flights}
          month={calendarMonth}
          year={calendarYear}
          onFlightClick={handleCalendarFlightClick}
          onMonthChange={handleCalendarMonthChange}
        />
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={handleLoginClose}
          onLogin={handleLogin}
          onShowRegister={handleShowRegister}
          onKakaoLogin={() => {
            setIsLoginModalOpen(false);
            const REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY;
            if (!REST_API_KEY) return;
            localStorage.removeItem('migration_old_uid');
            const REDIRECT_URI = window.location.origin + '/auth/kakao/callback';
            const KAKAO_AUTH_URL = `https://kauth.kakao.com/oauth/authorize?client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=friends`;
            window.location.href = KAKAO_AUTH_URL;
          }}
          onResetPassword={handlePasswordReset}
          isLoading={isLoginLoading}
          error={loginError}
        />
        <RegisterModal
          isOpen={isRegisterModalOpen}
          onClose={handleRegisterClose}
          onRegister={handleRegister}
          isLoading={isRegisterLoading}
          error={registerError}
        />
        <NoFlightModal
          isOpen={noFlightModal.isOpen}
          type={noFlightModal.type}
          onClose={handleNoFlightModalClose}
        />
      </Suspense>
      <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>}>
        <UserSettingsModal
          isOpen={isUserSettingsModalOpen}
          onClose={handleUserSettingsClose}
          currentUser={user}
          selectedAirline={selectedAirline}
          setSelectedAirline={setSelectedAirline}
          userInfo={userInfo}
          onSettingsUpdate={handleUserSettingsUpdate}
        />
        <ConflictResolutionModal
          isOpen={showConflictModal}
          onClose={handleConflictModalClose}
          conflicts={conflicts}
          onResolve={handleConflictResolution}
        />
        <CrewHistoryModal
          isOpen={isCrewHistoryModalOpen}
          onClose={handleCrewHistoryModalClose}
          crewName={selectedCrewName}
          flightsWithCrew={flightsWithSelectedCrew}
          onFlightClick={handleCrewHistoryFlightClick}
          onMemoClick={handleCrewMemoClick}
          crewType={selectedCrewType}
        />
        <CrewMemoModal
          isOpen={isCrewMemoModalOpen}
          onClose={handleCrewMemoModalClose}
          crewName={selectedCrewName}
          initialMemo={crewMemos[selectedCrewName] || ''}
          onSave={handleCrewMemoSave}
        />
        <CityScheduleModal
          isOpen={isCityScheduleModalOpen}
          onClose={() => {
            setIsCityScheduleModalOpen(false);
            // 검색 모달은 그대로 유지
          }}
          city={selectedCityForSchedule}
          flights={flights.filter(f => f.route && f.route.includes(selectedCityForSchedule || ''))}
          onFlightClick={(flight) => {
            setIsCityScheduleModalOpen(false);
            // 최신 데이터를 위해 flights 배열에서 해당 비행편을 찾아서 전달
            const latestFlight = flights.find(f => f.id === flight.id) || flight;
            setSelectedFlight(latestFlight);
          }}
          onMemoClick={handleCityMemoClick}
        />
        <CityMemoModal
          isOpen={isCityMemoModalOpen}
          onClose={handleCityMemoModalClose}
          cityCode={selectedCityForMemo}
          initialMemo={cityMemos[selectedCityForMemo] || ''}
          onSave={handleCityMemoSave}
        />

      </Suspense>
      <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>}>
        <AboutModal
          isOpen={isAboutModalOpen}
          onClose={handleAboutClose}
        />
        <CurrencySettingsModal
          isOpen={isCurrencySettingsModalOpen}
          onClose={handleCurrencySettingsClose}
          selectedCards={selectedCurrencyCards}
          onCardToggle={handleCurrencyCardToggle}
          onCardReorder={handleCurrencyCardReorder}
        />
        <PassportVisaWarningModal
          isOpen={isPassportVisaWarningOpen}
          onClose={handlePassportVisaWarningClose}
          onDismissForWeek={handlePassportVisaWarningDismiss}
          warnings={passportVisaWarnings}
        />
        <ExpiryDateModal
          isOpen={isExpiryDateModalOpen}
          onClose={handleExpiryDateModalClose}
          onSave={handleExpiryDateSave}
          cardType={selectedCardForExpiry?.type || ''}
          cardName={selectedCardForExpiry?.name || ''}
          currentExpiryDate={selectedCardForExpiry ? cardExpiryDates[selectedCardForExpiry.type] : undefined}
          theme={theme}
        />
        <DeleteDataModal
          isOpen={isDeleteDataModalOpen}
          onClose={() => setIsDeleteDataModalOpen(false)}
          onDelete={handleDeleteMonthData}
          flights={flights}
          isDeleting={isDeletingData}
        />

        <SearchModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          flights={flights}
          onCityClick={(cityCode) => {
            setSelectedCityForSchedule(cityCode);
            setIsCityScheduleModalOpen(true);
          }}
          onCrewClick={(crewName) => {
            // 해당 CREW가 포함된 비행들 필터링
            const flightsWithCrew = flights.filter(flight =>
              flight.crew && flight.crew.some((member: any) => member.name === crewName)
            );
            setSelectedCrewName(crewName);
            setFlightsWithSelectedCrew(flightsWithCrew);
            setIsCrewHistoryModalOpen(true);
          }}
        />





        <AnnualBlockTimeModal
          isOpen={isAnnualBlockTimeModalOpen}
          onClose={handleAnnualBlockTimeModalClose}
          flights={flights}
          currentYear={new Date().getFullYear()}
        />
      </Suspense>

      {/* 🔔 친구 요청 알림 토스트 */}
      {friendRequestAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-fade-in-up">
          <div
            className="glass-panel rounded-2xl px-5 py-3 flex items-center gap-3 shadow-2xl border border-indigo-500/30 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))' }}
            onClick={() => { setFriendRequestAlert(null); setActiveTab('friends'); }}
          >
            <span className="text-2xl">👋</span>
            <div>
              <div className="text-white font-medium text-sm">
                <span className="text-indigo-400 font-bold">{friendRequestAlert.name}</span>님이 친구 요청을 보냈습니다
              </div>
              <div className="text-slate-400 text-xs">탭하여 확인하기</div>
            </div>
          </div>
        </div>
      )}

      {/* 🔄 카카오 전환 권유 팝업 */}
      {showKakaoSwitchPopup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9998] p-4">
          <div className="glass-panel rounded-2xl p-6 w-full max-w-sm text-center"
            style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.99))' }}>
            <div className="text-4xl mb-4">💬</div>
            <h3 className="text-white font-bold text-lg mb-2">카카오톡 계정으로 전환하세요</h3>
            <p className="text-slate-400 text-sm mb-5 leading-relaxed">
              카카오톡 계정으로 전환하면<br />친구 추천 등 더 많은 기능을 사용할 수 있습니다.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowKakaoSwitchPopup(false);
                  setIsUserSettingsModalOpen(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2"
                style={{ backgroundColor: '#FEE500', color: '#000000' }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path fillRule="evenodd" clipRule="evenodd" d="M9.00002 0.599976C4.02917 0.599976 0 3.71296 0 7.55226C0 9.94002 1.55847 12.0452 3.93152 13.2969L2.93303 16.9452C2.85394 17.2359 3.18903 17.4666 3.44245 17.3011L7.76448 14.4258C8.16829 14.4753 8.58029 14.5045 9.00002 14.5045C13.9706 14.5045 18 11.3916 18 7.55226C18 3.71296 13.9706 0.599976 9.00002 0.599976" fill="#000000" />
                </svg>
                계정 전환하기
              </button>
              <button
                onClick={() => {
                  setShowKakaoSwitchPopup(false);
                  sessionStorage.setItem('kakao_switch_dismissed', 'true');
                }}
                className="w-full py-2.5 px-4 rounded-xl font-medium text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 border border-white/10"
              >
                나중에 하기
              </button>
            </div>
          </div>
        </div>
      )}

    </div >
  );
};

export default App;

