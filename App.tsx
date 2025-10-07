import React, { useState, useEffect, useRef, useCallback, useMemo, useTransition, Suspense, lazy } from 'react';
import RestCalculator from './components/RestCalculator';
import { Flight, CurrencyInfo, CurrencyModalData, MonthlyModalData, FlightStatus } from './types';
import { getTodayString } from './constants';
// 수동 버전 관리 제거됨 - 해시 기반 시스템 사용
import { calculateCurrency, findLastAndNextFlights, isActualFlight, mergeFlightDataWithStatusPreservation, replaceMonthDataWithStatusPreservation } from './utils/helpers';
import { toZonedTime } from 'date-fns-tz';
import { UploadCloudIcon, CalendarIcon, AirlineLogo, SettingsIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon, RefreshCwIcon } from './components/icons';
import FlightCard from './components/FlightCard';
import CurrencyCard from './components/CurrencyCard';
import BlockTimeCard from './components/BlockTimeCard';
const FlightDetailModal = lazy(() => import('./components/modals/FlightDetailModal'));
const CurrencyDetailModal = lazy(() => import('./components/modals/CurrencyDetailModal'));
const MonthlyScheduleModal = lazy(() => import('./components/modals/MonthlyScheduleModal'));
const CalendarModal = lazy(() => import('./components/modals/CalendarModal'));
const ConflictResolutionModal = lazy(() => import('./components/modals/ConflictResolutionModal'));
const AnnualBlockTimeModal = lazy(() => import('./components/modals/AnnualBlockTimeModal'));
import { getAllFlights, addFlight, updateFlight, deleteFlight, subscribeToAllFlights, addMultipleFlights, getUserSettings, saveUserSettings, saveDocumentExpiryDates, getDocumentExpiryDates, saveCrewMemos, getCrewMemos, saveCityMemos, getCityMemos, setFirebaseOfflineMode } from './src/firebase/database';
import { clearKeyCache } from './utils/encryption';
import { auth } from './src/firebase/config';
import { loginUser, logoutUser, registerUser, onAuthStateChange, getCurrentUser, updateUserName, updateUserPassword, resetPassword, getUserInfo } from './src/firebase/auth';
import { createSessionTimeout } from './utils/securityUtils';
import { parseExcelFile } from './utils/excelParser';
import { parsePDFFile } from './utils/pdfParser';
import { simpleCache } from './utils/simpleCache';
import { indexedDBCache } from './utils/indexedDBCache';
import { searchCompressedSchedules, getCompressedStats } from './data/flightSchedules';
import { separatedCache } from './utils/separatedCache';
import { cacheManager } from './utils/cacheManager';
import { syncStrategy } from './utils/syncStrategy';
import { ConflictInfo } from './utils/conflictResolver';
 
import { getAirlineByICAO } from './data/worldAirlines';
// Lazy loading for modal components to improve initial bundle size
const LoginModal = lazy(() => import('./components/LoginModal'));
const RegisterModal = lazy(() => import('./components/RegisterModal'));
const NoFlightModal = lazy(() => import('./components/modals/NoFlightModal'));
const UserSettingsModal = lazy(() => import('./components/UserSettingsModal'));
const CrewHistoryModal = lazy(() => import('./components/modals/CrewHistoryModal'));
const CrewMemoModal = lazy(() => import('./components/modals/CrewMemoModal'));
const CityMemoModal = lazy(() => import('./components/modals/CityMemoModal'));
const CityScheduleModal = lazy(() => import('./components/modals/CityScheduleModal'));
const AboutModal = lazy(() => import('./components/modals/AboutModal'));
const CurrencySettingsModal = lazy(() => import('./components/modals/CurrencySettingsModal'));
const PassportVisaWarningModal = lazy(() => import('./components/modals/PassportVisaWarningModal'));
const ExpiryDateModal = lazy(() => import('./components/modals/ExpiryDateModal'));
const DeleteDataModal = lazy(() => import('./components/modals/DeleteDataModal'));
const SearchModal = lazy(() => import('./components/modals/SearchModal'));
import { fetchAirlineData, fetchAirlineDataWithInfo, searchAirline, getAirlineByCode, AirlineInfo, AirlineDataInfo } from './utils/airlineData';
import { getCityInfo, getFlightTime } from './utils/cityData';
import { worldAirlines } from './data/worldAirlines';
import { calculateWarnings, dismissWarningForWeek, isWarningDismissed, getSamplePassportVisaData, WarningData } from './utils/passportVisaWarning';
 
// Service Worker 관련 import
import { registerServiceWorker, onOnlineStatusChange, getServiceWorkerManager } from './utils/serviceWorker';
import { getCurrentFileHashes, isLatestVersion, checkAndUpdate, saveVersionInfo } from './src/utils/hashVersion';

// IATA/ICAO 코드를 정규화하는 함수 (IATA -> ICAO 변환)
const getICAOCode = (airlineCode: string): string => {
  const iataToIcaoMap: { [key: string]: string } = {
    'OZ': 'AAR',  // Asiana Airlines
    'KE': 'KAL',  // Korean Air
    '7C': 'JJA',  // Jeju Air
    'TW': 'TWB',  // T'way Air
    'BX': 'ABL',  // Air Busan
    'ZE': 'ESR',  // Eastar Jet
    'LJ': 'JNA',  // Jin Air
    'RS': 'ASV',  // Air Seoul
    'YP': 'APZ',  // Air Premia
    'RF': 'EOK',  // Aerokorea
    'NH': 'ANA',  // All Nippon Airways
    'JL': 'JAL',  // Japan Airlines
    'MM': 'APJ',  // Peach Aviation
  };
  
  // 이미 ICAO 코드인지 확인 (3글자)
  if (airlineCode.length === 3) {
    // ICAO 코드인 경우 그대로 반환
    return airlineCode;
  }
  
  // IATA 코드인 경우 ICAO로 변환
  return iataToIcaoMap[airlineCode] || airlineCode;
};

// 항공사명을 가져오는 함수
const getAirlineName = (iataCode: string): string => {
  const airline = worldAirlines.find(a => a.iata === iataCode);
  return airline?.koreanName || iataCode;
};

// 네트워크 상태 확인 함수 (오류 로그 없이 204 엔드포인트 사용)
const checkNetworkStatus = async (): Promise<boolean> => {
  try {
    // navigator.onLine으로 기본적인 온라인 상태 확인
    if (!navigator.onLine) {
      return false;
    }

    // 실제 네트워크 연결 확인 (204 응답, 크로스오리진 가능, SW 미개입)
    await fetch('https://www.google.com/generate_204', {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-cache',
      signal: AbortSignal.timeout(3000)
    });
    // no-cors 요청은 opaque로 돌아오므로 도달만 해도 온라인으로 간주
    return true;
  } catch (error) {
    return false;
  }
};

// 새로고침 실행 (온라인 시 최신 버전 확인 후만 리로드)
const safeReload = async (reason: string = '새로고침') => {
  console.log(`🔄 ${reason} 요청`);
  // 오프라인이면 아무 것도 하지 않음
  if (!navigator.onLine) {
    console.log('🚫 오프라인 상태: 새로고침 취소');
    return false;
  }
  try {
    // 최신 버전인지 확인하고 최신이 아닐 때만 업데이트 로직 수행
    const latest = await isLatestVersion();
    if (!latest) {
      await checkAndUpdate();
      return true;
    }
    // 이미 최신이면 그대로 유지 (리로드 안 함)
    console.log('✅ 이미 최신 버전입니다. 리로드하지 않습니다.');
    return false;
  } catch (e) {
    console.warn('새로고침 중 버전 확인 실패. 리로드 생략:', e);
    return false;
  }
};


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

const DISPLAY_VERSION = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_APP_DISPLAY_VERSION) ? (import.meta as any).env.VITE_APP_DISPLAY_VERSION : '1.0.0';

const App: React.FC = () => {
  // React 18 Concurrent Features
  const [isPending, startTransition] = useTransition();

  
  // 상태 관리
  const [user, setUser] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<{ displayName: string | null; empl?: string; userName?: string; company?: string } | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ pendingCount: 0, isSyncing: false });
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [selectedFlightType, setSelectedFlightType] = useState<'last' | 'next' | undefined>(undefined);
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
  const [selectedAirline, setSelectedAirline] = useState('OZ');
  const [baseIata, setBaseIata] = useState<string | undefined>(undefined);
  const [isCrewHistoryModalOpen, setIsCrewHistoryModalOpen] = useState(false);
  const [selectedCrewName, setSelectedCrewName] = useState<string>('');
  const [flightsWithSelectedCrew, setFlightsWithSelectedCrew] = useState<Flight[]>([]);
  const [selectedCrewType, setSelectedCrewType] = useState<'flight' | 'cabin'>('flight');
  const [isCrewMemoModalOpen, setIsCrewMemoModalOpen] = useState(false);
  const [crewMemos, setCrewMemos] = useState<{[key: string]: string}>({});
  const [isCityMemoModalOpen, setIsCityMemoModalOpen] = useState(false);
  const [selectedCityForMemo, setSelectedCityForMemo] = useState<string>('');
  const [cityMemos, setCityMemos] = useState<{[key: string]: string}>({
    'FCO': '테스트 메모: FCO 로마 공항에 대한 메모입니다.'
  });
  const [isCityScheduleModalOpen, setIsCityScheduleModalOpen] = useState(false);
  const [selectedCityForSchedule, setSelectedCityForSchedule] = useState<string>('');
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isCurrencyExpanded, setIsCurrencyExpanded] = useState(false);
  const [isIosStandalone, setIsIosStandalone] = useState(false);
  const [isCurrencySettingsModalOpen, setIsCurrencySettingsModalOpen] = useState(false);
  const [selectedCurrencyCards, setSelectedCurrencyCards] = useState<string[]>(['passport', 'visa', 'epta', 'radio', 'whitecard']);
  const [noFlightModal, setNoFlightModal] = useState({ isOpen: false, type: 'last' as 'last' | 'next' });
  const [isPassportVisaWarningOpen, setIsPassportVisaWarningOpen] = useState(false);
  const [passportVisaWarnings, setPassportVisaWarnings] = useState<WarningData[]>([]);
  const [isExpiryDateModalOpen, setIsExpiryDateModalOpen] = useState(false);
  const [selectedCardForExpiry, setSelectedCardForExpiry] = useState<{type: string, name: string} | null>(null);
  const [cardExpiryDates, setCardExpiryDates] = useState<{[key: string]: string}>({});
  const [isAnnualBlockTimeModalOpen, setIsAnnualBlockTimeModalOpen] = useState(false);
  const [isDeleteDataModalOpen, setIsDeleteDataModalOpen] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
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
    return localStorage.getItem('theme') || 'system';
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'rest' | 'flightData'>('dashboard');

  // 탭 전환 함수 (오프라인 상태에서도 정상 작동)
  const handleTabChange = useCallback((tab: 'dashboard' | 'rest' | 'flightData') => {
    setActiveTab(tab);
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);



  // 현재 테마 상태 계산
  const isDarkMode = useMemo(() => {
    return theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, [theme]);

  // 테마 관리
  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = () => {
      const isDark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.classList.toggle('dark', isDark);
    };
    applyTheme();
    localStorage.setItem('theme', theme);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  // Service Worker 등록 및 오프라인 상태 관리
  useEffect(() => {
    // 앱 시작 시 네트워크 우선 확인 후 모드 고정 (오프라인 퍼스트 보장)
    (async () => {
      try {
        const online = await checkNetworkStatus();
        setIsOffline(!online);
        setFirebaseOfflineMode(!online);
      } catch (e) {
        const offline = !navigator.onLine;
        setIsOffline(offline);
        setFirebaseOfflineMode(offline);
      }
    })();
    const initializeServiceWorker = async () => {
      try {
        // Service Worker 지원 여부 확인
        if ('serviceWorker' in navigator) {
          const registered = await registerServiceWorker();
          if (registered) {
            console.log('Service Worker registered successfully');
            // 핵심 자산 사전 캐시 (사파리 재개/비행모드 재시작 대응)
            try {
              const manager = getServiceWorkerManager();
              const urls = new Set<string>(['/','/index.html']);
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
            } catch {}
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

    // 온라인/오프라인 상태 변경 감지 (안정성 향상)
    const unsubscribe = onOnlineStatusChange((isOnline) => {
      console.log('🌐 네트워크 상태 변경:', isOnline ? '온라인' : '오프라인');
      
      // 상태 변경을 지연시켜 빈번한 전환 방지
      const timeoutId = setTimeout(() => {
        setIsOffline(!isOnline);
        
        if (isOnline && user) {
          console.log('🔄 온라인 복구: 동기화 시작');
          // 온라인으로 복구되면 동기화 시도
          handleSyncWhenOnline();
        }
        
        // Firebase RTDB 연결 상태 동기화
        try {
          setFirebaseOfflineMode(!isOnline);
        } catch (error) {
          console.error('❌ Firebase 오프라인 모드 설정 실패:', error);
        }
      }, 1000); // 1초 지연으로 상태 안정화
      
      // 기존 타이머 정리
      return () => clearTimeout(timeoutId);
    });

    return unsubscribe;
  }, [user]);

  // UTC 시간 업데이트 (30초 단위)
  useEffect(() => {
    const updateUtcTime = () => {
      const now = new Date();
      const utcHours = now.getUTCHours().toString().padStart(2, '0');
      const utcMinutes = now.getUTCMinutes().toString().padStart(2, '0');
      setUtcTime(`${utcHours}:${utcMinutes}Z`);
    };

    // 초기 실행
    updateUtcTime();

    // 30초마다 업데이트
    const interval = setInterval(updateUtcTime, 30000);

    return () => clearInterval(interval);
  }, []);

  // iOS PWA(홈화면 추가) 환경 감지: 안전영역 보정용 상태
  useEffect(() => {
    const isIOS = /iphone|ipod|ipad/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isIOS && isStandalone) setIsIosStandalone(true);
  }, []);

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
    }
  }, [user]);


  // 항공사 데이터 로드
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

    loadAirlineData();
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

    // ICAO 코드를 IATA 코드로 변환
    let searchQuery = flightSearchQuery.trim().toUpperCase();
    const airlineCode = searchQuery.replace(/[0-9]/g, ''); // 숫자 제거하여 항공사 코드만 추출
    
    // ICAO 코드인지 확인 (3글자)
    if (airlineCode.length === 3) {
      const airlineInfo = getAirlineByICAO(airlineCode);
      if (airlineInfo) {
        const flightNumber = searchQuery.replace(airlineCode, airlineInfo.iata);
        searchQuery = flightNumber;
      }
    }

    setIsLoadingFlightData(true);
    try {
      let results = [];
      
      if (navigator.onLine) {
        
        // 1단계: 인천공항 API 검색
        try {
          const apiResults = await searchFlightsFromIncheon(searchQuery);
          if (apiResults.length > 0) {
            results = apiResults;
          } else {
            
            // 2단계: 오프라인 DB 검색
            const offlineResults = searchCompressedSchedules(searchQuery);
            
            if (offlineResults.length > 0) {
              results = offlineResults.map(flight => {
                const [departure, arrival] = flight.route.split('/');
                const airline = flight.airlineFlightNumber.replace(/[0-9]/g, '').toUpperCase();
                return {
                  flightNumber: flight.airlineFlightNumber.toUpperCase(),
                  airline: airline,
                  departure: departure?.toUpperCase() || '',
                  arrival: arrival?.toUpperCase() || '',
                  time: '', // 시간 표시하지 않음
                  aircraft: '',
                  status: '스케줄 정보',
                  type: '오프라인 DB'
                };
              });
            }
          }
        } catch (apiError) {
          console.error('❌ 인천공항 API 오류:', apiError);
          
          // API 오류 시 오프라인 DB 검색
          const offlineResults = searchCompressedSchedules(searchQuery);
          
          if (offlineResults.length > 0) {
            results = offlineResults.map(flight => {
              const [departure, arrival] = flight.route.split('/');
              const airline = flight.airlineFlightNumber.replace(/[0-9]/g, '').toUpperCase();
              return {
                flightNumber: flight.airlineFlightNumber.toUpperCase(),
                airline: airline,
                departure: departure?.toUpperCase() || '',
                arrival: arrival?.toUpperCase() || '',
                time: '', // 시간 표시하지 않음
                aircraft: '',
                status: '스케줄 정보',
                type: '오프라인 DB'
              };
            });
          }
        }
      } else {
        
        // 오프라인일 때: 오프라인 DB만 검색
        const offlineResults = searchCompressedSchedules(searchQuery);
        
        if (offlineResults.length > 0) {
          results = offlineResults.map(flight => {
            const [departure, arrival] = flight.route.split('/');
            const airline = flight.airlineFlightNumber.replace(/[0-9]/g, '').toUpperCase();
            return {
              flightNumber: flight.airlineFlightNumber.toUpperCase(),
              airline: airline,
              departure: departure?.toUpperCase() || '',
              arrival: arrival?.toUpperCase() || '',
              time: '', // 시간 표시하지 않음
              aircraft: '',
              status: '스케줄 정보',
              type: '오프라인 DB'
            };
          });
        }
      }
      
      // 결과 설정
      setFlightSearchResults(results);
      setShowFlightResults(true);
      
      if (results.length > 0) {
      } else {
      }

    } catch (error) {
      console.error('항공편 검색 오류:', error);
      setFlightSearchResults([]);
    } finally {
      setIsLoadingFlightData(false);
    }
  }, [flightSearchQuery]);





  // 인천공항 API를 통한 항공편 검색
  const searchFlightsFromIncheon = async (query: string) => {
    try {
      // 항공편명 형식 검증 (IATA 코드 + 숫자)
      const flightMatch = query.match(/^([A-Z]{2,3})(\d+)$/);
      if (!flightMatch) {
        return [];
      }


      const response = await fetch('/api/incheon/flights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          flightNumber: query,
          searchType: 'both' // 출발편과 도착편 모두 검색
        })
      });

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const data = await response.json();
      return data.results || [];

    } catch (error) {
      console.error('인천공항 API 검색 오류:', error);
      return [];
    }
  };



  // 로컬 데이터베이스에서 항공편 검색 (구글 스프레드시트 동기화된 데이터 사용)
  const searchFlightsFromGoogleSheets = async (query: string) => {
    try {
      if ((import.meta as any).env?.DEV) {
      }
      
      // 로컬 데이터베이스에서 검색 (구글 스프레드시트에서 동기화된 최신 데이터)
      const results = searchFlightsFromLocalDB(query);
      if ((import.meta as any).env?.DEV) {
      }
      
      // 검색 결과를 20개로 제한하여 성능 개선
      return results.slice(0, 20);
      
    } catch (error) {
      console.error('로컬 데이터베이스 검색 오류:', error);
      return [];
    }
  };

  // 구글 스프레드시트 데이터 가져오기
  // 기기 데이터베이스에서 항공편 검색
  const searchFlightsFromLocalDB = (query: string) => {
    try {
      
      // localStorage에서 항공편 데이터 가져오기
      const internationalFlights = JSON.parse(localStorage.getItem('internationalFlights') || '[]');
      const domesticFlights = JSON.parse(localStorage.getItem('domesticFlights') || '[]');
      
      
      const allFlights = [...internationalFlights, ...domesticFlights];
      const results: any[] = [];
      
      // 검색어와 매칭되는 항공편 찾기
      for (const flight of allFlights) {
        const flightNumber = flight.flightNumber || '';
        const hasMatch = flightNumber.toLowerCase().includes(query.toLowerCase());
        
        if (hasMatch) {
          results.push({
            flightNumber: flight.flightNumber || '',
            airline: flight.airline || '',
            departure: flight.departure || '',
            arrival: flight.arrival || '',
            time: flight.time || '',
            aircraft: flight.aircraft || '',
            status: flight.status || '정시',
            type: '로컬 DB'
          });
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('로컬 데이터베이스 검색 오류:', error);
      return [];
    }
  };

  // 구글 스프레드시트 데이터를 로컬 데이터베이스에 동기화 (버전 비교 후 최신일 때만)
  const syncGoogleSheetsToLocalDB = async () => {
    try {
      
      // 한국공항공사 공개 게시된 스프레드시트 링크 (API 키 불필요)
      const INTERNATIONAL_PUBLISHED_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQXqM6gsOYJ2W2_blrOtc2m8J-VfOl8QB0Zivbn_9F28te1v7LI8QiL4YFuotwDhpnmtyNDbvy2UvRl/pubhtml?gid=495590094&single=true';
      const DOMESTIC_PUBLISHED_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQiJ3470gAonQ0jEfsIxidwH17521WPqz0Aa9rm-27sRROB9wfPqiLJqiRr_ch_x-7DSMgHpPYyN0ki/pubhtml?gid=2000046295&single=true';
      
      // CSV 형태로 데이터 가져오기 (공개 링크)
      const internationalCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQXqM6gsOYJ2W2_blrOtc2m8J-VfOl8QB0Zivbn_9F28te1v7LI8QiL4YFuotwDhpnmtyNDbvy2UvRl/pub?output=csv&gid=495590094';
      const domesticCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQiJ3470gAonQ0jEfsIxidwH17521WPqz0Aa9rm-27sRROB9wfPqiLJqiRr_ch_x-7DSMgHpPYyN0ki/pub?output=csv&gid=2000046295';
      
      
      // 1단계: 국제선 CSV 데이터 가져오기
      const internationalResponse = await fetch(internationalCsvUrl);
      
      if (!internationalResponse.ok) {
        console.error('❌ 국제선 CSV 데이터 가져오기 오류:', internationalResponse.status);
        return false;
      }
      
      const internationalCsvText = await internationalResponse.text();
      
      // 2단계: 국내선 CSV 데이터 가져오기
      const domesticResponse = await fetch(domesticCsvUrl);
      
      if (!domesticResponse.ok) {
        console.error('❌ 국내선 CSV 데이터 가져오기 오류:', domesticResponse.status);
        return false;
      }
      
      const domesticCsvText = await domesticResponse.text();
      
      // 3단계: CSV 데이터 파싱 및 변환
      const internationalFlights: any[] = [];
      const domesticFlights: any[] = [];
      
      // CSV를 행으로 분할
      const internationalRows = internationalCsvText.split('\n').filter(row => row.trim());
      const domesticRows = domesticCsvText.split('\n').filter(row => row.trim());
      
      // 국제선 데이터 처리 (첫 번째 행은 헤더)
      for (let i = 1; i < internationalRows.length; i++) {
        const row = internationalRows[i];
        const columns = row.split(',').map(col => col.trim().replace(/"/g, ''));
        
        if (columns.length >= 6) {
          const flight = {
            flightNumber: columns[0] || '', // 항공편 번호
            airline: columns[1] || '',     // 항공사 코드
            departure: columns[2] || '',   // 출발지
            arrival: columns[3] || '',     // 도착지
            time: columns[4] || '',        // 시간
            aircraft: columns[5] || '',    // 기종
            status: columns[6] || '정시'   // 상태
          };
          
          if (flight.flightNumber && flight.airline) {
            internationalFlights.push(flight);
          }
        }
      }
      
      // 국내선 데이터 처리 (첫 번째 행은 헤더)
      for (let i = 1; i < domesticRows.length; i++) {
        const row = domesticRows[i];
        const columns = row.split(',').map(col => col.trim().replace(/"/g, ''));
        
        if (columns.length >= 6) {
          const flight = {
            flightNumber: columns[0] || '', // 항공편 번호
            airline: columns[1] || '',     // 항공사 코드
            departure: columns[2] || '',   // 출발지
            arrival: columns[3] || '',     // 도착지
            time: columns[4] || '',        // 시간
            aircraft: columns[5] || '',    // 기종
            status: columns[6] || '정시'   // 상태
          };
          
          if (flight.flightNumber && flight.airline) {
            domesticFlights.push(flight);
          }
        }
      }
      
      // 4단계: 로컬 데이터베이스에 저장
      localStorage.setItem('internationalFlights', JSON.stringify(internationalFlights));
      localStorage.setItem('domesticFlights', JSON.stringify(domesticFlights));
      localStorage.setItem('lastGoogleSheetsSync', new Date().toISOString());
      
      
      return true;
      
    } catch (error) {
      console.error('❌ 구글 스프레드시트 동기화 오류:', error);
      return false;
    }
  };

  // 나머지 데이터 점진적 처리 (성능 최적화)
  const processRemainingData = async (allData: Flight[], chunkSize: number, userId: string) => {
    try {
      for (let i = chunkSize; i < allData.length; i += chunkSize) {
        const chunk = allData.slice(i, i + chunkSize);
        
        // UI 업데이트를 최소화하여 성능 향상 (React 18 Concurrent)
        startTransition(() => {
          setFlights(prev => [...prev, ...chunk]);
        });
        
        // 청크 간 지연으로 브라우저 응답성 유지
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error('나머지 데이터 처리 오류:', error);
    }
  };

  // 오프라인 데이터 로드 (초기 로딩 시)
  useEffect(() => {
    if (user?.uid && !navigator.onLine) {
      const cachedFlights = simpleCache.loadFlights(user.uid);
      if (cachedFlights && cachedFlights.length > 0) {
        startTransition(() => {
          setFlights(cachedFlights);
        });
        console.log('✅ 초기 로딩: SimpleCache 데이터 로드 성공');
      }
    }
  }, [user]);

  // 초기 데이터 로딩 (오프라인 지원)
  const fetchInitialData = useCallback(async () => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // 네트워크 상태 확인 (더 안정적인 방법)
      const isOnline = navigator.onLine && !isOffline;
      
      if (!isOnline) {
        console.log('📱 오프라인 모드: 캐시된 데이터 로드 시작');
        
        // 다중 캐시 소스에서 데이터 로드 시도 (우선순위 순서)
        const cacheSources = [
          { name: 'IndexedDB', loader: () => indexedDBCache.loadFlights(user.uid) },
          { name: 'SimpleCache', loader: () => Promise.resolve(simpleCache.loadFlights(user.uid)) }
        ];
        
        let loadedFlights = null;
        let usedCacheSource = '';
        
        for (const source of cacheSources) {
          try {
            console.log(`🔄 ${source.name}에서 데이터 로드 시도 중...`);
            const flights = await source.loader();
            
            if (flights && Array.isArray(flights) && flights.length > 0) {
              loadedFlights = flights;
              usedCacheSource = source.name;
              console.log(`✅ ${source.name}: ${flights.length}개 비행 데이터 로드 성공`);
              break;
            } else {
              console.log(`⚠️ ${source.name}: 데이터 없음 또는 빈 배열`);
            }
          } catch (error) {
            console.error(`❌ ${source.name} 로드 실패:`, error);
          }
        }
        
        if (loadedFlights) {
          startTransition(() => {
            setFlights(loadedFlights);
          });
          setIsLoading(false);
          console.log(`🎉 오프라인 모드: ${usedCacheSource}에서 데이터 로드 완료`);
          return;
        } else {
          console.log('⚠️ 오프라인 모드: 모든 캐시 소스에서 데이터 로드 실패');
          startTransition(() => {
            setFlights([]);
          });
          setIsLoading(false);
          return;
        }
      }
      
      // 온라인 상태에서 Firebase 데이터 가져오기
      
      if (!auth.currentUser) {
        startTransition(() => {
          setFlights([]);
        });
        setIsLoading(false);
        return;
      }
      
      const firebaseFlights = await getAllFlights(user.uid);
      
      if (firebaseFlights && firebaseFlights.length > 0) {
        
        // 데이터를 작은 청크로 나누어 처리
        const CHUNK_SIZE = 500;
        const firstChunk = firebaseFlights.slice(0, CHUNK_SIZE);
        startTransition(() => {
          setFlights(firstChunk);
        });
        
        // 나머지 데이터는 백그라운드에서 점진적으로 처리
        if (firebaseFlights.length > CHUNK_SIZE) {
          setTimeout(async () => {
            await processRemainingData(firebaseFlights, CHUNK_SIZE, user.uid);
          }, 100);
        }
        
        // IndexedDB에 저장
        setTimeout(async () => {
          try {
            await indexedDBCache.saveFlights(firebaseFlights, user.uid);
          } catch (cacheError) {
            console.warn('⚠️ 캐시 시스템 실패:', cacheError);
          }
        }, 500);
      } else {
        // IndexedDB에서 캐시된 데이터 로드
        const cachedFlights = await indexedDBCache.loadFlights(user.uid);
        if (cachedFlights && cachedFlights.length > 0) {
          startTransition(() => {
            setFlights(cachedFlights);
          });
        } else {
          startTransition(() => {
            setFlights([]);
          });
        }
      }
    } catch (error) {
      console.error('데이터 로딩 오류:', error);
      // IndexedDB에서 캐시된 데이터 로드 시도
      try {
        const cachedFlights = await indexedDBCache.loadFlights(user.uid);
        if (cachedFlights && cachedFlights.length > 0) {
          startTransition(() => {
            setFlights(cachedFlights);
          });
        } else {
          startTransition(() => {
            setFlights([]);
          });
        }
      } catch (cacheError) {
        console.warn('⚠️ 캐시 로드도 실패:', cacheError);
        startTransition(() => {
          setFlights([]);
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

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
        setConflicts(result.conflicts);
        setShowConflictModal(true);
      }
    } catch (error) {
      console.error('동기화 중 오류:', error);
    }
  }, [user, flights, fetchInitialData]);

  // 네트워크 상태 감지는 Service Worker에서 처리됨

  // Web Worker cleanup on unmount
  

  // 해시 기반 최신성 확인 시스템 (Service Worker 완전 제거됨)
  useEffect(() => {
    const initializeHashSystem = async () => {
      try {
        // 현재 파일 해시 정보 저장
        const currentHashes = getCurrentFileHashes();
        saveVersionInfo(currentHashes);
        
        console.log('🚀 Flight Dashboard - 해시 기반 버전 관리 시스템 초기화');
        console.log('📁 현재 파일 해시:', currentHashes);
        
        // 자동 버전 체크/자동 업데이트 제거됨
      } catch (error) {
        console.error('❌ 해시 시스템 초기화 실패:', error);
      }
    };
    
    initializeHashSystem();
  }, []);

  // Service Worker 관련 함수 제거됨

  // Service Worker 메시지 리스너 제거됨

  // 초기 데이터 로딩
  useEffect(() => {
    if (user && user.uid) {
      fetchInitialData();
      
      // 10초 타임아웃 설정 (로딩이 너무 오래 지속되는 것을 방지)
      const timeoutId = setTimeout(() => {
        setIsLoading(false);
      }, 10000);
      
      return () => clearTimeout(timeoutId);
    } else {
      setIsLoading(false);
    }
  }, [fetchInitialData, user]);

  // 동기화 상태 업데이트
  useEffect(() => {
    if (user?.uid) {
      const status = syncStrategy.getSyncStatus();
      setSyncStatus(status);
    }
  }, [user]);



  // 실시간 데이터 구독
  useEffect(() => {
    if (user && user.uid) {
      const unsubscribe = subscribeToAllFlights((firebaseFlights) => {
        if (firebaseFlights && firebaseFlights.length > 0) {
          setFlights(firebaseFlights);
          simpleCache.saveFlights(firebaseFlights, user.uid);
        } else {
          setFlights([]);
        }
      }, user.uid);
      
      return () => {
        unsubscribe();
      };
    }
  }, [user]);

  // 실시간 다음/최근 비행 업데이트 (1분마다)
  useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        setFlights(prev => [...prev]); // 강제 리렌더링
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [user]);

  // 인증 상태 감지 (온라인/오프라인 감지 포함)
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      if ((import.meta as any).env?.DEV) {
      }
      setUser(user);
      if (!user) {
        setFlights([]);
        setIsLoading(false);
        setUserInfo(null); // 로그아웃 시 사용자 정보 초기화
        setSelectedAirline('OZ'); // 로그아웃 시 기본값으로 리셋
        setSelectedCurrencyCards(['passport', 'visa', 'epta', 'radio', 'whitecard']); // 로그아웃 시 기본 카드로 리셋
        setCardExpiryDates({}); // 로그아웃 시 문서 만료일 데이터 초기화
        setCrewMemos({}); // 로그아웃 시 crew 메모 데이터 초기화
        setCityMemos({}); // 로그아웃 시 도시 메모 데이터 초기화
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
        // 사용자 정보 가져오기 (EMPL 정보 포함)
        try {
          const userInfoData = await getUserInfo(user.uid);
          if (userInfoData) {
            setUserInfo({
              displayName: userInfoData.displayName,
              empl: userInfoData.empl,
              userName: userInfoData.userName,
              company: userInfoData.company
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
        
        // 세션 타임아웃 설정 (30분)
        const timeout = createSessionTimeout(30 * 60 * 1000);
        setSessionTimeout(timeout);
        
        
        // 로그인 시 사용자 설정 및 문서 만료일 불러오기
        try {
          const userSettings = await getUserSettings(user.uid);
          if (userSettings.airline) {
            setSelectedAirline(userSettings.airline);
          }
          if (userSettings.base) {
            setBaseIata(String(userSettings.base).toUpperCase());
          }
          if (userSettings.selectedCurrencyCards) {
            setSelectedCurrencyCards(userSettings.selectedCurrencyCards);
          }
          
          // 문서 만료일 데이터 불러오기
          const documentExpiryDates = await getDocumentExpiryDates(user.uid);
          setCardExpiryDates(documentExpiryDates);
          
          // Crew 메모 불러오기
          const crewMemos = await getCrewMemos(user.uid);
          setCrewMemos(crewMemos);
          
          // 도시 메모 불러오기
          const cityMemos = await getCityMemos(user.uid);
          setCityMemos(cityMemos);
        } catch (error) {
          console.error('사용자 설정 및 문서 만료일 불러오기 실패:', error);
        } finally {
          // 로그인 시에도 로딩 상태 확실히 해제
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
      setFlights(updatedFlights);
      
      setUploadMessage(`${year}년 ${month}월 데이터가 삭제되었습니다.`);
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
      return '.xls,.xlsx';
    } else if (company === '7C') {
      return '.pdf';
    }
    return '.xls,.xlsx,.pdf'; // 기본값
  };

  // 파일 업로드 핸들러
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    // 기본 파일 형식 검증
    if (fileExtension !== 'xls' && fileExtension !== 'xlsx' && fileExtension !== 'pdf') {
      setUploadError('Excel 파일(.xls, .xlsx) 또는 PDF 파일(.pdf)만 업로드 가능합니다.');
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
      if (userCompany === 'KE' || userCompany === 'OZ') {
        // KE, OZ는 Excel만 허용
        if (fileExtension !== 'xls' && fileExtension !== 'xlsx') {
          setUploadError(`${userCompany} 항공사는 Excel 파일(.xls, .xlsx)만 업로드 가능합니다.`);
          setTimeout(() => setUploadError(''), 5000);
          return;
        }
      } else if (userCompany === '7C') {
        // 7C는 PDF만 허용
        if (fileExtension !== 'pdf') {
          setUploadError('제주항공(7C)은 PDF 파일(.pdf)만 업로드 가능합니다.');
          setTimeout(() => setUploadError(''), 5000);
          return;
        }
      }
      
      // 파일 타입에 따라 적절한 파서 선택
      let newFlights: Flight[];
      let isPDFFile = false;
      // 직전 업로드 시각을 보존하여 이번 배치에서 변경된 항목만 표시하기 위한 기준 저장
      try {
        const prevUploadAt = localStorage.getItem('last_upload_at') || '';
        localStorage.setItem('last_upload_prev', prevUploadAt);
      } catch {}
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

      if (fileExtension === 'pdf') {
        console.log('📄 PDF 파일 파싱 시작');
        newFlights = await parsePDFFile(file, userCompany, userName, empl);
        isPDFFile = true; // PDF는 파서에서 이미 Firebase 저장됨
        console.log('📄 PDF 파일 파싱 완료:', { flightsCount: newFlights.length });
      } else {
        console.log('📊 Excel 파일 파싱 시작');
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
        setFlights(updatedFlights);
        // 변경 날짜 계산 및 저장
        try {
          const changedDatesSet = new Set<string>();
          if (prevAllFlights && prevAllFlights.length > 0) {
            const makeDateSignature = (flightsArr: any[], date: string) => {
              const items = flightsArr
                .filter(f => f.date === date && !(f.route === '' && (!f.crew || f.crew.length === 0) && (!f.cabinCrew || f.cabinCrew.length === 0)))
                .map((f: any) => `${f.flightNumber||''}|${f.scheduleType||''}|${f.route||''}|${f.std||''}|${f.sta||''}|${f.acType||''}|${f.departureDateTimeUtc||''}|${f.arrivalDateTimeUtc||''}|${f.showUpDateTimeUtc||''}`)
                .sort();
              return items.join('||');
            };
            const allDates = new Set<string>([...prevAllFlights, ...updatedFlights].map((f: any)=>f.date));
            for (const d of allDates) {
              const beforeSig = makeDateSignature(prevAllFlights, d);
              const afterSig = makeDateSignature(updatedFlights, d);
              if (beforeSig !== afterSig) changedDatesSet.add(d);
            }
          }
          const stamp = new Date().toISOString();
          localStorage.setItem('last_upload_changed_dates', JSON.stringify({ at: stamp, dates: Array.from(changedDatesSet) }));
          localStorage.setItem('last_upload_at', stamp);
        } catch {}
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
          const key = `${d.getFullYear()}-${d.getMonth() + 1}`; // 1-based month (zero-pad 불필요: 아래와 동일 포맷)
          const weight = f.monthlyTotalBlock ? 10 : 1; // 파일의 대표 월 신뢰도 가중치
          monthScoreMap[key] = (monthScoreMap[key] || 0) + weight;
        } catch {}
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
        const key = `${year}-${month}`;
        
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
        
        
        // 브리핑 정보 파일인지 감지 (route가 비어있고 승무원 정보만 있는 경우)
        const isBriefingFile = monthFlights.some(flight => 
          flight.route === '' && 
          (flight.crew.length > 0 || flight.cabinCrew.length > 0) &&
          flight.flightNumber && 
          flight.date
        );
        
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
      setFlights(updatedFlights);
      // 변경 날짜 계산 및 저장
      try {
        const changedDatesSet = new Set<string>();
        if (prevAllFlights && prevAllFlights.length > 0) {
          const makeDateSignature = (flightsArr: any[], date: string) => {
            const items = flightsArr
              .filter(f => f.date === date && !(f.route === '' && (!f.crew || f.crew.length === 0) && (!f.cabinCrew || f.cabinCrew.length === 0)))
              .map((f: any) => `${f.flightNumber||''}|${f.scheduleType||''}|${f.route||''}|${f.std||''}|${f.sta||''}|${f.acType||''}|${f.departureDateTimeUtc||''}|${f.arrivalDateTimeUtc||''}|${f.showUpDateTimeUtc||''}`)
              .sort();
            return items.join('||');
          };
          const allDates = new Set<string>([...prevAllFlights, ...updatedFlights].map((f: any)=>f.date));
          for (const d of allDates) {
            const beforeSig = makeDateSignature(prevAllFlights, d);
            const afterSig = makeDateSignature(updatedFlights, d);
            if (beforeSig !== afterSig) changedDatesSet.add(d);
          }
        }
        const stamp = new Date().toISOString();
        localStorage.setItem('last_upload_changed_dates', JSON.stringify({ at: stamp, dates: Array.from(changedDatesSet) }));
        localStorage.setItem('last_upload_at', stamp);
      } catch {}
      
      // ✨ 스마트 업데이트 결과 메시지
      const totalNewCount = updatedFlights.length - allExistingFlights.length;
      const totalUpdatedCount = updatedFlights.filter(f => f.version && f.version > 0).length;
      
      const processedMonths = Object.keys(flightsByMonth).map(key => {
        const [year, month] = key.split('-');
        return `${year}년 ${month}월`;
      }).join(', ');
      
      setUploadMessage(`✅ 다중 월 스마트 업데이트 완료 (${processedMonths}): ${totalNewCount}개 추가, ${totalUpdatedCount}개 업데이트, 이착륙 상태 보존됨`);
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

      // 2) IndexedDB 캐시 삭제
      if ('indexedDB' in window) {
        try {
          const deletePromises = [
            new Promise<void>((resolve) => {
              const deleteReq = indexedDB.deleteDatabase('flightCache');
              deleteReq.onsuccess = () => resolve();
              deleteReq.onerror = () => resolve();
              deleteReq.onblocked = () => resolve();
            }),
            new Promise<void>((resolve) => {
              const deleteReq = indexedDB.deleteDatabase('separatedCache');
              deleteReq.onsuccess = () => resolve();
              deleteReq.onerror = () => resolve();
              deleteReq.onblocked = () => resolve();
            }),
            new Promise<void>((resolve) => {
              const deleteReq = indexedDB.deleteDatabase('simpleCache');
              deleteReq.onsuccess = () => resolve();
              deleteReq.onerror = () => resolve();
              deleteReq.onblocked = () => resolve();
            })
          ];
          await Promise.all(deletePromises);
        } catch (error) {
          console.warn('⚠️ IndexedDB 삭제 중 오류:', error);
        }
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
        await fetch(`/index.html?ts=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
      } catch {}
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

    
    // 항공편 찾기 (타입 불일치 해결을 위해 String() 변환 사용)
    const flightToUpdate = flights.find(f => String(f.id) === String(flightId));
    if (!flightToUpdate) {
      console.error('항공편을 찾을 수 없음:', { 
        flightId, 
        flightIdType: typeof flightId,
        availableIds: flights.map(f => ({ id: f.id, type: typeof f.id, flightNumber: f.flightNumber }))
      });
      throw new Error(`항공편을 찾을 수 없습니다: ${flightId}`);
    }

    const originalFlights = flights;
    
    try {
      // 즉시 UI 업데이트 (낙관적 업데이트)
      const updatedFlights = flights.map(flight => {
        if (String(flight.id) === String(flightId)) {
          return {
            ...flight,
            status: {
              ...flight.status,
              [statusToToggle]: !flight.status?.[statusToToggle]
            }
          };
        }
        return flight;
      });
      
      // 즉시 상태 업데이트 (React 18 Concurrent)
      startTransition(() => {
        setFlights(updatedFlights);
      });
      
      // 백그라운드에서 Firebase 업데이트
      if (user.uid) {
        const updatedFlight = updatedFlights.find(f => String(f.id) === String(flightId));
        if (updatedFlight) {
          const dataToUpdate = {
            status: {
              ...updatedFlight.status,
              [statusToToggle]: updatedFlight.status?.[statusToToggle]
            },
            lastModified: new Date().toISOString()
          };
          
          // Firebase 업데이트는 백그라운드에서 처리
          updateFlight(flightId, dataToUpdate, user.uid).catch(error => {
            console.error('Firebase 업데이트 실패:', error);
            // Firebase 업데이트 실패 시 원래 상태로 복원
            startTransition(() => {
              setFlights(originalFlights);
            });
            alert('서버 동기화에 실패했습니다. 다시 시도해주세요.');
          });
        }
      }
    } catch (error) {
      console.error('비행 상태 업데이트 오류:', error);
      startTransition(() => {
        setFlights(originalFlights);
      });
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
      
      // 암호화 키 캐시 정리 (추가 보장)
      clearKeyCache();
      
    } catch (error) {
      console.error('로그아웃 오류:', error);
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
  const handleStatusChange = useCallback(async (flightId: string, status: Partial<FlightStatus>) => {
    try {
      // flights 배열에서 해당 비행을 찾아서 상태 업데이트
      const updatedFlights = flights.map(flight => {
        if (flight.id === flightId) {
          // status 필드가 없는 경우 초기화
          if (!flight.status) {
            flight.status = { departed: false, landed: false };
          }
          
          const currentStatus = flight.status;
          const newStatus = {
            departed: currentStatus.departed || false,
            landed: currentStatus.landed || false,
            ...status
          };
          
          
          return {
            ...flight,
            status: newStatus
          };
        }
        return flight;
      });
      
      // 로컬 상태 업데이트 (즉시 반영)
      setFlights(updatedFlights);
      
      // monthlyModalData도 업데이트 (월 스케줄 모달에서 즉시 반영)
      if (monthlyModalData) {
        const updatedMonthlyData = {
          ...monthlyModalData,
          flights: monthlyModalData.flights.map(flight => {
            if (flight.id === flightId) {
              return {
                ...flight,
                status: {
                  ...flight.status,
                  ...status
                }
              };
            }
            return flight;
          })
        };
        setMonthlyModalData(updatedMonthlyData);
      }
      
      // selectedFlight도 업데이트 (비행 상세 모달에서 즉시 반영)
      if (selectedFlight && selectedFlight.id === flightId) {
        setSelectedFlight({
          ...selectedFlight,
          status: {
            ...selectedFlight.status,
            ...status
          }
        });
      }
      
      // Firebase와 IndexedDB에 저장 (백그라운드)
      if (user?.uid) {
        try {
          // Firebase에 저장 - 전체 status 객체를 전달
          const { updateFlight } = await import('./src/firebase/database');
          const flightToUpdate = updatedFlights.find(f => f.id === flightId);
          if (flightToUpdate) {
            await updateFlight(parseInt(flightId), { status: flightToUpdate.status }, user.uid);
          }
          
          // IndexedDB에도 저장 (선택적)
          const { indexedDBCache } = await import('./utils/indexedDBCache');
          const indexeDBStatus = await indexedDBCache.checkIndexedDBStatus(user.uid as string);
          
          if (indexeDBStatus.flightCount > 0) {
            const flightToUpdate = updatedFlights.find(f => f.id === flightId);
            if (flightToUpdate) {
              await indexedDBCache.updateFlight(parseInt(flightId), { status: flightToUpdate.status }, user.uid as string);
            }
          } else {
          }
        } catch (error) {
          console.error('데이터베이스 저장 오류:', error);
        }
      }
    } catch (error) {
      console.error('상태 변경 오류:', error);
    }
  }, [flights, monthlyModalData, selectedFlight, user]);

  // 모달 관련 핸들러들 - useCallback으로 최적화
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

  const handleMonthClick = useCallback((month: number, monthFlights?: Flight[]) => {
    // 해당 월의 비행 데이터 필터링 (monthFlights가 제공되지 않은 경우에만)
    const flightsToUse = monthFlights || flights.filter(flight => {
      const flightDate = new Date(flight.date);
      return flightDate.getMonth() === month;
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
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }

      // 모든 방법이 실패하면 00:00 반환
      return '00:00';
    };

    // block 시간 계산
    const blockTime = getDutyTime(flightsToUse);
    setMonthlyModalData({ month, flights: flightsToUse, blockTime });
  }, [flights]);

  // 월별 스케줄 모달에서 월 변경 핸들러
  const handleMonthlyModalMonthChange = (month: number) => {
    handleMonthClick(month);
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
    
    const today = toZonedTime(`${todayStr}T00:00:00`, KOREA_TIME_ZONE);
    const sixMonthsAgo = toZonedTime(`${todayStr}T00:00:00`, KOREA_TIME_ZONE);
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    
    const sixMonthFlights = flights.filter(f => {
      try {
        const flightDate = toZonedTime(`${f.date}T00:00:00`, KOREA_TIME_ZONE);
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

  // 기존 비행편에 regNo 필드 추가하는 함수
  const addRegNoToExistingFlights = async () => {
    try {
      if (!user) {
        throw new Error('사용자가 로그인되지 않았습니다.');
      }

      
      // 모든 비행편을 가져와서 regNo 필드가 없는 것들에 추가
      const allFlights = [...flights];
      let updatedCount = 0;
      
      for (const flight of allFlights) {
        // regNo 필드가 없거나 비어있는 경우에만 추가
        if (!flight.regNo) {
          // 예시: regNo를 빈 문자열로 초기화 (실제로는 OZ 파서에서 파싱된 값이 있어야 함)
          const updatedFlight = {
            ...flight,
            regNo: '', // 빈 문자열로 초기화
            lastModified: new Date().toISOString(),
            version: (flight.version || 0) + 1
          };
          
          // Firebase에 업데이트
          await handleEditFlight(updatedFlight);
          updatedCount++;
        }
      }
      
      return updatedCount;
      
    } catch (error) {
      console.error('❌ regNo 필드 추가 중 오류:', error);
      throw error;
    }
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
        flightPath = `users/${user.uid}/flights/${year}/${month}/${flight._storagePath.firebaseKey}`;
      } else {
        // 기존 방식: 날짜에서 년/월 추출
        const flightDate = new Date(flight.date);
        year = flightDate.getFullYear();
        month = (flightDate.getMonth() + 1).toString().padStart(2, '0');
        flightPath = `users/${user.uid}/flights/${year}/${month}/${flight.id}`;
      }
      
      // Firebase에 업데이트
      const { set } = await import('firebase/database');
      const { ref } = await import('firebase/database');
      const { database } = await import('./src/firebase/config');
      
      const flightRef = ref(database, flightPath);
      
      
      
      await set(flightRef, flight);
      
      
      // IndexedDB에도 업데이트 (새로운 함수 사용)
      const { indexedDBCache } = await import('./utils/indexedDBCache');
      await indexedDBCache.updateFlightData(flight);
      
      // 🔄 앱 상태 즉시 업데이트 (새로고침 없이 반영)
      setFlights(prevFlights => {
        const updatedFlights = prevFlights.map(f => 
          f.id === flight.id ? { ...flight, _storagePath: { year, month, firebaseKey: flight._storagePath?.firebaseKey || flight.id.toString() } } : f
        );
        return updatedFlights;
      });
      
      // selectedFlight도 업데이트 (현재 열린 모달의 데이터 동기화)
      setSelectedFlight(prevSelected => 
        prevSelected && prevSelected.id === flight.id 
          ? { ...flight, _storagePath: { year, month, firebaseKey: flight._storagePath?.firebaseKey || flight.id.toString() } }
          : prevSelected
      );
      
      
    } catch (error) {
      alert(`수정 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  // 스케줄 삭제 핸들러
  const handleDeleteFlight = async (flightId: number) => {
    try {
      
      // Firebase에서 삭제
      const { remove } = await import('firebase/database');
      const { ref } = await import('firebase/database');
      const { database } = await import('./src/firebase/config');
      
      if (!user) {
        throw new Error('사용자가 로그인되지 않았습니다.');
      }
      
      // 해당 비행편 찾기
      const flight = flights.find(f => f.id === flightId);
      if (!flight) {
        throw new Error('삭제할 비행편을 찾을 수 없습니다.');
      }
      
      // _storagePath 정보가 있으면 사용, 없으면 날짜 기반으로 경로 구성
      let flightPath;
      
      if (flight._storagePath) {
        // _storagePath 정보를 사용해서 정확한 경로 구성
        flightPath = `users/${user.uid}/flights/${flight._storagePath.year}/${flight._storagePath.month}/${flight._storagePath.firebaseKey}`;
      } else {
        // 기존 방식: 날짜에서 년/월 추출
        const flightDate = new Date(flight.date);
        const year = flightDate.getFullYear();
        const month = (flightDate.getMonth() + 1).toString().padStart(2, '0');
        flightPath = `users/${user.uid}/flights/${year}/${month}/${flightId}`;
      }
      
      const flightRef = ref(database, flightPath);
      
      // Firebase에서 삭제
      await remove(flightRef);
      
      // IndexedDB에서도 삭제
      const { indexedDBCache } = await import('./utils/indexedDBCache');
      await indexedDBCache.deleteFlight(flightId);
      
      // 로컬 상태에서 해당 항목 제거 (즉시 반영)
      setFlights(prevFlights => {
        const updatedFlights = prevFlights.filter(f => f.id !== flightId);
        return updatedFlights;
      });
      
      // 캐시도 즉시 업데이트
      if (user?.uid) {
        const { simpleCache } = await import('./utils/simpleCache');
        const cachedFlights = simpleCache.loadFlights(user.uid);
        if (cachedFlights) {
          const updatedCachedFlights = cachedFlights.filter(f => f.id !== flightId);
          simpleCache.saveFlights(updatedCachedFlights, user.uid);
        }
      }
      
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
              return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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
      'FIXED SKD','STANDBY','DAY OFF','A STBY','B STBY','G/S STUDENT','GS STUDENT','G/S','GS','GROUND SCHOOL','R_SIM1','R_SIM2','RESERVE','OTHRDUTY','RDO','ALV','ALM','ANNUAL LEAVE','VAC_R','VAC','SIM','MEDICAL CHK','MEDICAL','안전회의','SAFETY','TRAINING','교육','BRIEFING','브리핑','MEETING','회의','CHECK','점검','INSPECTION','검사'
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
            return new Date(`${f.date}T${hhStr}:${mmStr}:00Z`).getTime();
          }
          return new Date(`${f.date}T00:00:00Z`).getTime();
        }
      } catch {}
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
        .filter((f) => isActual(f) && typeof f.route === 'string' && f.route.toUpperCase().startsWith(`${arrivalCode.toUpperCase()}/`))
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
      route: `${dep}/???`,
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
  const cardItemWidth = Math.max(0, (sliderContainerWidth - GAP_PX) / 2);
  const roundedItemWidth = Math.round(cardItemWidth);
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
    
    if (isLeftSwipe && currentCardIndex < cardData.length - 2) {
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
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto"></div>
          <p className="text-xl font-semibold text-gray-700 dark:text-gray-300 mt-4">데이터를 불러오는 중...</p>
        </div>
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
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center mb-6">
              로그인
            </h2>
            <button
              onClick={handleLoginClick}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              로그인하기
            </button>
            <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-4">
              계정이 없으신가요? <button onClick={handleShowRegister} className="text-blue-600 hover:text-blue-700 underline">회원가입</button>
            </p>
          </div>
          
          <footer className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex justify-center items-center gap-4">
            <p>My KneeBoard © 2025. v{DISPLAY_VERSION}</p>
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
            <div className="bg-red-500 text-white text-center py-2 px-4 mb-4">
              <div className="flex items-center justify-center gap-2">
                <span>📡 오프라인 모드</span>
                {syncStatus.pendingCount > 0 && (
                  <span className="text-sm">
                    ({syncStatus.pendingCount}개 작업 대기 중)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 헤더 */}
          <header className={`mb-4 flex justify-between items-center gap-2 sm:gap-4 ${isIosStandalone ? 'pt-safe' : ''}`}>
            {/* Left: User Info */}
            <div className="flex-1 flex justify-start">
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-gray-700 dark:text-gray-300">
                  {user.displayName}님
                </span>
                  <div className="bg-transparent">
                    <AirlineLogo airline={selectedAirline} className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={handleUserSettingsClick}
                    className="bg-gray-500 text-white text-xs px-1.5 py-0.5 rounded hover:bg-gray-600 transition-colors"
                    title="설정"
                  >
                    설정
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded hover:bg-red-600 transition-colors"
                    title="로그아웃"
                  >
                    로그아웃
                  </button>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {utcTime}
                </div>
              </div>
            </div>

            {/* Center: Title */}
            <div className="flex-1 text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                My<br />KneeBoard
              </h1>
            </div>
            
            {/* Right: Upload Icon & Date */}
            <div className="flex-1 flex justify-end">
              <div className="flex flex-col items-end">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept={getAllowedFileTypes(userInfo?.company || 'OZ')}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleHardRefresh}
                    disabled={isRefreshing || isOffline}
                    title={isOffline ? "오프라인 상태에서는 새로고침할 수 없습니다" : "Clear Cache & Hard Refresh"}
                    className={`p-1.5 rounded-full text-gray-600 dark:text-gray-400 hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${(isRefreshing || isOffline) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <RefreshCwIcon className={`w-6 h-6 ${isRefreshing ? 'animate-clock-rotation' : ''}`} />
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
                    <UploadCloudIcon className={`w-6 h-6 ${isUploading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 text-right">
                  <p>{todayDatePart}</p>
                  <p>{todayWeekdayPart}(KST) 기준</p>
                </div>
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
          <div className="mb-1">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => handleTabChange('dashboard')}
                className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'dashboard'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => handleTabChange('rest')}
                className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'rest'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Rest
              </button>
              <button
                onClick={() => handleTabChange('flightData')}
                className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'flightData'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Flight Data
              </button>
            </div>
          </div>

          {/* 탭 내용 */}
          {activeTab === 'dashboard' && (
            <>
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
                      title="도시/CREW 검색"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={handleCalendarClick}
                      className="flex items-center justify-center p-2 text-blue-600 hover:text-blue-700 transition-colors rounded-lg"
                      title="전체 달력 보기"
                    >
                      <CalendarIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <BlockTimeCard 
                  flights={flights} 
                  todayStr={todayStr} 
                  onMonthClick={handleMonthClick}
                />
              </section>

              <section className="mb-8">
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
                        ? `translateX(-${sliderOffsetPx}px)` 
                        : `translateX(-${currentCardIndex * 51.5}%)`,
                      willChange: 'transform'
                    }}
                  >
                    {cardData.map((card, index) => (
                      <div 
                        key={`${card.type}-${index}`} 
                        className="flex-shrink-0"
                        style={{ width: cardItemWidth > 0 ? `${cardItemWidth}px` : 'calc((100% - 24px)/2)' }}
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
                          className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                            i === currentCardIndex ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
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
                    const tempCurrencyInfo = {
                      current: 0,
                      required: 0,
                      lastFlight: null,
                      nextRequired: null
                    };

                    const cardNames: { [key: string]: string } = {
                      'passport': '여권',
                      'visa': '비자',
                      'epta': 'EPTA',
                      'radio': 'Radio',
                      'whitecard': 'White Card'
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
            </>
          )}

          {activeTab === 'rest' && (
            <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
              <RestCalculator isDark={isDarkMode} />
            </div>
          )}

          {activeTab === 'flightData' && (
            <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'} p-3 rounded-lg`}>
              {/* Flight Data 섹션 */}
              <section className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-300">Flight Data</h2>
                </div>
                
                {/* 검색 카드 그리드 */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* 항공편 검색 카드 */}
                  <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow-sm border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} hover:shadow-md transition-shadow`}>
                    <div className="mb-3">
                      <div className="font-semibold text-gray-700 dark:text-gray-300">항공편 검색</div>
                    </div>
                    <div className="mb-3">
                      <input
                        type="text"
                        placeholder="항공편명 입력 (예: OZ521)"
                        value={flightSearchQuery}
                        onChange={(e) => setFlightSearchQuery(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isLoadingFlightData) {
                            handleFlightSearch();
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase ${
                          isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                        }`}
                      />
                    </div>
                    <button 
                      onClick={handleFlightSearch}
                      disabled={isLoadingFlightData}
                      className={`w-full px-4 py-2 text-white text-sm rounded-lg transition-colors font-medium ${
                        isLoadingFlightData 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-blue-500 hover:bg-blue-600'
                      }`}
                    >
                      {isLoadingFlightData ? '검색 중...' : '검색'}
                    </button>
                  </div>

                  {/* 항공사 정보 카드 */}
                  <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow-sm border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} hover:shadow-md transition-shadow`}>
                    <div className="mb-3">
                      <div className="font-semibold text-gray-700 dark:text-gray-300">항공사 정보</div>
                    </div>
                    <div className="mb-3">
                      <input
                        type="text"
                        placeholder="IATA/ICAO 코드 입력"
                        value={airlineSearchQuery}
                        onChange={(e) => setAirlineSearchQuery(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isLoadingAirlineData) {
                            handleAirlineSearch();
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase ${
                          isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                        }`}
                      />
                    </div>
                    <button 
                      onClick={handleAirlineSearch}
                      disabled={isLoadingAirlineData}
                      className={`w-full px-4 py-2 text-white text-sm rounded-lg transition-colors font-medium ${
                        isLoadingAirlineData 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-blue-500 hover:bg-blue-600'
                      }`}
                    >
                      {isLoadingAirlineData ? '로딩 중...' : '검색'}
                    </button>
                  </div>


                </div>

                {/* 항공편 검색 결과 섹션 */}
                {showFlightResults && (
                <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} p-4 mb-4 relative`}>
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
                    flightSearchResults.map((flight, index) => (
                      <div key={index} className={`${isDarkMode ? 'bg-gradient-to-br from-gray-700 to-gray-800' : 'bg-gradient-to-br from-gray-50 to-white'} p-4 rounded-xl shadow-md border ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} hover:shadow-lg transition-all duration-300 mb-3`}>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                              <h4 className="text-lg font-bold text-gray-700 dark:text-gray-300">
                                {flight.flightNumber}({getICAOCode(flight.airline)}{flight.flightNumber?.replace(/^[A-Z]+/, '')})
                              </h4>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {getAirlineName(flight.airline)}
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold rounded-full shadow-sm">
                            {flight.type.includes('인천공항 API') ? '온라인' : flight.type}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex-1 text-center">
                            <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">출발</div>
                            <div className="font-semibold text-gray-700 dark:text-gray-300 text-lg md:text-xl">{flight.origin || flight.departure}</div>
                            <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                              {getCityInfo(flight.origin || flight.departure)?.name || ''}
                            </div>
                          </div>
                          
                          <div className="flex-1 text-center">
                            <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">도착</div>
                            <div className="font-semibold text-gray-700 dark:text-gray-300 text-lg md:text-xl">{flight.destination || flight.arrival}</div>
                            <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                              {getCityInfo(flight.destination || flight.arrival)?.name || ''}
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          {flight.aircraft && flight.aircraft.trim() && flight.type.includes('인천공항 API') && (
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                              <span className="text-gray-500 dark:text-gray-400">기종:</span>
                              <span className="font-medium text-gray-700 dark:text-gray-300">
                                {flight.aircraft}
                              </span>
                            </div>
                          )}
                          {flight.weeklySchedule && flight.type.includes('인천공항 API') && (
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                              <span className="text-gray-500 dark:text-gray-400">운항:</span>
                              <span className="font-medium text-gray-700 dark:text-gray-300">
                                {flight.weeklySchedule}
                              </span>
                            </div>
                          )}
                          
                          {flight.operatingDays && flight.operatingDays.length > 0 && (
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                              <span className="text-gray-500 dark:text-gray-400">운항:</span>
                              <span className="font-medium text-gray-700 dark:text-gray-300">
                                {(() => {
                                  const days = flight.operatingDays.map(date => {
                                    const dateObj = new Date(date);
                                    return ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
                                  });
                                  
                                  // 요일 정렬 (월요일부터 시작)
                                  const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];
                                  const sortedDays = days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
                                  
                                  // 중복 제거
                                  const uniqueDays = [...new Set(sortedDays)];
                                  
                                  // 매일인지 확인
                                  if (uniqueDays.length === 7) {
                                    return '매일';
                                  }
                                  
                                  return uniqueDays.join(', ');
                                })()}
                              </span>
                            </div>
                          )}
                        </div>
                        

                      </div>
                    ))
                  ) : (
                    <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} p-6 rounded-lg text-center`}>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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
                <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} p-4 relative`}>
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
                      <div key={index} className={`${isDarkMode ? 'bg-gradient-to-br from-gray-700 to-gray-800' : 'bg-gradient-to-br from-gray-50 to-white'} p-4 rounded-xl shadow-md border ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} hover:shadow-lg transition-all duration-300 mb-3`}>
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
                    <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} p-6 rounded-lg text-center`}>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {airlineSearchQuery.trim() ? '검색 결과가 없습니다.' : 'IATA/ICAO 코드, 항공사명, 호출부호로 검색하세요.'}
                      </p>
                    </div>
                  )}
                </div>
                )}
              </section>
            </div>
          )}
          
          <footer className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex justify-center items-center gap-4">
            <p>My KneeBoard © 2025. v{DISPLAY_VERSION}</p>
              <button 
                onClick={handleAboutClick}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
              >
                정보
              </button>
            </div>
          </footer>
        </div>
      )}

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
          theme={theme}
          setTheme={setTheme}
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
    </div>
  );
};

export default App;

