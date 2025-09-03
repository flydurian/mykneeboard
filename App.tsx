import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import RestCalculator from './components/RestCalculator';
import { Flight, CurrencyInfo, CurrencyModalData, MonthlyModalData } from './types';
import { getTodayString } from './constants';
import { calculateCurrency, findLastAndNextFlights } from './utils/helpers';
import { UploadCloudIcon, CalendarIcon } from './components/icons';
import FlightCard from './components/FlightCard';
import CurrencyCard from './components/CurrencyCard';
import BlockTimeCard from './components/BlockTimeCard';
import FlightDetailModal from './components/modals/FlightDetailModal';
import CurrencyDetailModal from './components/modals/CurrencyDetailModal';
import MonthlyScheduleModal from './components/modals/MonthlyScheduleModal';
import CalendarModal from './components/modals/CalendarModal';
import ConflictResolutionModal from './components/modals/ConflictResolutionModal';
import { getAllFlights, addFlight, updateFlight, deleteFlight, subscribeToAllFlights, addMultipleFlights, testDatabaseConnection } from './src/firebase/database';
import { auth } from './src/firebase/config';
import { loginUser, logoutUser, registerUser, onAuthStateChange, getCurrentUser, updateUserName, updateUserPassword, resetPassword } from './src/firebase/auth';
import { parseExcelFile } from './utils/excelParser';
import { simpleCache } from './utils/simpleCache';
import { indexedDBCache } from './utils/indexedDBCache';
import { separatedCache } from './utils/separatedCache';
import { cacheManager } from './utils/cacheManager';
import { networkDetector } from './utils/networkDetector';
import { syncStrategy } from './utils/syncStrategy';
import { ConflictInfo } from './utils/conflictResolver';
import LoginModal from './components/LoginModal';
import RegisterModal from './components/RegisterModal';
import NoFlightModal from './components/modals/NoFlightModal';
import UserSettingsModal from './components/UserSettingsModal';
import CrewHistoryModal from './components/modals/CrewHistoryModal';
import CityScheduleModal from './components/modals/CityScheduleModal';
import { mergeFlightDataWithStatusPreservation, replaceMonthDataWithStatusPreservation } from './utils/helpers';
import { fetchAirlineData, fetchAirlineDataWithInfo, searchAirline, getAirlineByCode, AirlineInfo, AirlineDataInfo, formatDate } from './utils/airlineData';

// ICAO 코드를 가져오는 함수
const getICAOCode = (iataCode: string): string => {
  const airlineMap: { [key: string]: string } = {
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
  
  return airlineMap[iataCode] || iataCode;
};


const App: React.FC = () => {
  // 상태 관리
  const [user, setUser] = useState<any>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ pendingCount: 0, isSyncing: false });
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [currencyModalData, setCurrencyModalData] = useState<CurrencyModalData | null>(null);
  const [monthlyModalData, setMonthlyModalData] = useState<MonthlyModalData | null>(null);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isUserSettingsModalOpen, setIsUserSettingsModalOpen] = useState(false);
  const [isCrewHistoryModalOpen, setIsCrewHistoryModalOpen] = useState(false);
  const [selectedCrewName, setSelectedCrewName] = useState<string>('');
  const [flightsWithSelectedCrew, setFlightsWithSelectedCrew] = useState<Flight[]>([]);
  const [isCityScheduleModalOpen, setIsCityScheduleModalOpen] = useState(false);
  const [selectedCityForSchedule, setSelectedCityForSchedule] = useState<string>('');
  const [noFlightModal, setNoFlightModal] = useState({ isOpen: false, type: 'last' as 'last' | 'next' });
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
const [utcTime, setUtcTime] = useState('');
const [isOnline, setIsOnline] = useState(navigator.onLine);
const [showFlightResults, setShowFlightResults] = useState(false);
const [showAirlineResults, setShowAirlineResults] = useState(false);
const [airlineData, setAirlineData] = useState<AirlineInfo[]>([]);
const [airlineDataInfo, setAirlineDataInfo] = useState<AirlineDataInfo | null>(null);
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

  // 캐시 상태 모니터링 (24시간마다)
  useEffect(() => {
    if (!user?.uid) return;
    
    const monitorCache = async () => {
      try {
        await cacheManager.printCacheStats(user.uid);
      } catch (error) {
        console.error('캐시 모니터링 실패:', error);
      }
    };
    
    monitorCache();
    const interval = setInterval(monitorCache, 24 * 60 * 60 * 1000); // 24시간마다
    
    return () => clearInterval(interval);
  }, [user]);

  // 네트워크 상태 감지
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  // 항공편 검색 함수 (Amadeus API만 사용)
  const handleFlightSearch = useCallback(async () => {
    if (!flightSearchQuery.trim()) {
      setFlightSearchResults([]);
      return;
    }

    setIsLoadingFlightData(true);
    try {
      if (isOnline) {
        // 온라인일 때 Amadeus API 검색
        const results = await searchFlightsFromAmadeus(flightSearchQuery);
        setFlightSearchResults(results);
        setShowFlightResults(true);
      } else {
        // 오프라인일 때 Firebase 캐시 데이터 검색
        const results = searchFlightsFromLocalDB(flightSearchQuery);
        setFlightSearchResults(results);
        setShowFlightResults(true);
      }
    } catch (error) {
      console.error('항공편 검색 오류:', error);
      setFlightSearchResults([]);
    } finally {
      setIsLoadingFlightData(false);
    }
  }, [flightSearchQuery, isOnline]);

  // 항공사 코드를 IATA 코드로 변환
  const convertToIATACode = (input: string): string | null => {
    // 1. 이미 IATA 코드인 경우 (2-3글자)
    if (/^[A-Z]{2,3}$/.test(input)) {
      const airline = airlineData.find(a => a.iata === input);
      if (airline) {
        return input; // 이미 IATA 코드
      }
    }
    
    // 2. ICAO 코드인 경우
    const icaoMatch = airlineData.find(a => a.icao === input);
    if (icaoMatch) {
      return icaoMatch.iata;
    }
    
    // 3. 항공사명으로 검색 (영문/한글)
    const nameMatch = airlineData.find(a => 
      a.name.toLowerCase().includes(input.toLowerCase()) ||
      a.koreanName.includes(input)
    );
    if (nameMatch) {
      return nameMatch.iata;
    }
    
    // 4. 콜사인으로 검색
    const callsignMatch = airlineData.find(a => 
      a.callsign.toLowerCase().includes(input.toLowerCase())
    );
    if (callsignMatch) {
      return callsignMatch.iata;
    }
    
    return null;
  };

  // 항공편명을 항공사 코드와 숫자로 분리
  const parseFlightNumber = (flightNumber: string) => {
    // 항공편명에서 항공사 코드와 숫자 부분 분리
    // 예: OZ112 → { airlineCode: 'OZ', flightNumber: '112' }
    const match = flightNumber.match(/^([A-Z]{2,3})(\d+)$/);
    if (match) {
      return {
        airlineCode: match[1],
        flightNumber: match[2]
      };
    }
    return null;
  };

  // Vercel API를 통해 Amadeus 항공편 검색
  const searchFlightsFromAmadeus = async (query: string) => {
    try {
      // 항공편명 파싱
      const parsed = parseFlightNumber(query);
      console.log('🔍 항공편명 파싱 결과:', parsed);
      
      if (!parsed) {
        console.log('❌ 항공편명 형식이 올바르지 않음:', query);
        return [];
      }

      // 항공사 코드를 IATA 코드로 변환
      const iataCode = convertToIATACode(parsed.airlineCode);
      console.log('🔄 항공사 코드 변환:', parsed.airlineCode, '→', iataCode);
      
      if (!iataCode) {
        console.log('❌ 유효한 항공사 코드를 찾을 수 없음:', parsed.airlineCode);
        return [];
      }

      const response = await fetch('http://localhost:3000/api/amadeus/flights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          airlineCode: iataCode,
          flightNumber: parsed.flightNumber,
          originalQuery: query
        })
      });

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const data = await response.json();
      return data.results || [];

    } catch (error) {
      console.error('Amadeus API 검색 오류:', error);
      return [];
    }
  };

  // 온라인 상태에서 구글 스프레드시트 + Amadeus API 조합 검색
  const searchFlightsCombined = async (query: string) => {
    try {
      console.log('🔍 통합 검색 시작:', query);
      
      // 1단계: 로컬 데이터베이스에서 노선 정보 검색 (구글 스프레드시트 동기화된 데이터)
      const localResults = searchFlightsFromLocalDB(query);
      console.log('📊 로컬 데이터베이스 검색 결과:', localResults);
      
      let results = [];
      
      if (localResults.length > 0) {
        console.log('✅ 로컬 데이터베이스에서 노선 정보 찾음, Amadeus API로 상세 정보 가져오기');
        // 2단계: 각 노선에 대해 Amadeus API로 상세 정보 가져오기
        const enhancedResults = await Promise.all(
          localResults.map(async (flight) => {
            try {
                          // 출발지와 도착지가 있는 경우에만 Amadeus API 호출
            if (flight.departure && flight.arrival) {
              // 항공사 코드를 IATA 코드로 변환
              const iataCode = convertToIATACode(flight.airline);
              console.log('🔄 통합 검색 항공사 코드 변환:', flight.airline, '→', iataCode);
              
              if (!iataCode) {
                console.log('⚠️ 항공사 코드 변환 실패, 기본 정보만 반환:', flight.airline);
                return {
                  ...flight,
                  hasDetailedSchedule: false
                };
              }

              // 사용자가 입력한 항공편 번호를 기준으로 Amadeus API 호출
              const userFlightNumber = query.replace(/[^0-9]/g, ''); // 숫자만 추출
              const userAirline = query.replace(/[0-9]/g, ''); // 항공사 코드만 추출
              
              console.log('🎯 사용자 입력 기준 Amadeus API 호출:', {
                origin: flight.departure,
                destination: flight.arrival,
                airline: iataCode,
                flightNumber: userFlightNumber
              });
              
              const amadeusResponse = await fetch('http://localhost:3000/api/amadeus/flight-schedule', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  origin: flight.departure,
                  destination: flight.arrival,
                  airline: iataCode,
                  flightNumber: userFlightNumber
                })
              });

                if (amadeusResponse.ok) {
                  const amadeusData = await amadeusResponse.json();
                  return {
                    // 로컬 데이터베이스에서 가져온 노선 정보
                    ...flight,
                    type: '로컬 DB + Amadeus API',
                    
                    // Amadeus API에서 가져온 상세 정보
                    duration: amadeusData.duration,
                    operatingDays: amadeusData.operatingDays,
                    aircraftInfo: amadeusData.aircraftInfo,
                    
                    hasDetailedSchedule: true
                  };
                }
              }
              
              // Amadeus API 호출 실패 시 로컬 데이터에서 상세 정보 찾기
              console.log('⚠️ Amadeus API 호출 실패, 로컬 데이터에서 상세 정보 찾기 시도');
              
              try {
                const localResults = searchFlightsFromLocalDB(query);
                if (localResults.length > 0) {
                  console.log('✅ 로컬 데이터에서 상세 정보 찾음:', localResults[0]);
                  return {
                    ...flight,
                    ...localResults[0], // 로컬 데이터의 상세 정보로 덮어쓰기
                    hasDetailedSchedule: true,
                    type: '구글 스프레드시트 + 로컬 데이터'
                  };
                }
              } catch (localError) {
                console.error('로컬 데이터 검색 오류:', localError);
              }
              
              // 로컬 데이터도 없으면 구글 스프레드시트 정보만 반환
              return {
                ...flight,
                hasDetailedSchedule: false
              };
            } catch (error) {
              console.error(`Amadeus API 호출 오류 (${flight.flightNumber}):`, error);
              return {
                ...flight,
                hasDetailedSchedule: false
              };
            }
          })
        );
        
        results = enhancedResults;
      } else {
        // 3단계: 로컬 DB에서 찾지 못한 경우 Amadeus API로 직접 검색
        console.log('📊 로컬 DB에서 결과를 찾지 못함, Amadeus API로 직접 검색 시도');
        
        try {
          const amadeusResults = await searchFlightsFromAmadeus(query);
          console.log('✈️ Amadeus API 직접 검색 결과:', amadeusResults);
          
          if (amadeusResults.length > 0) {
            results = amadeusResults.map(flight => ({
              ...flight,
              type: 'Amadeus API',
              hasDetailedSchedule: true,
              // Amadeus API 결과를 표준 형식으로 변환
              origin: flight.departure,
              destination: flight.arrival
            }));
          }
        } catch (error) {
          console.error('Amadeus API 직접 검색 오류:', error);
        }
      }

      console.log('🎯 최종 검색 결과:', results);
      return results;

    } catch (error) {
      console.error('통합 검색 오류:', error);
      return [];
    }
  };

  // 로컬 데이터베이스에서 항공편 검색 (구글 스프레드시트 동기화된 데이터 사용)
  const searchFlightsFromGoogleSheets = async (query: string) => {
    try {
      console.log('📊 로컬 데이터베이스 검색 시작 (구글 스프레드시트 동기화된 데이터):', query);
      
      // 로컬 데이터베이스에서 검색 (구글 스프레드시트에서 동기화된 최신 데이터)
      const results = searchFlightsFromLocalDB(query);
      console.log('📊 로컬 DB 총 검색 결과:', results);
      
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
      console.log('🔍 로컬 데이터베이스 검색 시작:', query);
      
      // localStorage에서 항공편 데이터 가져오기
      const internationalFlights = JSON.parse(localStorage.getItem('internationalFlights') || '[]');
      const domesticFlights = JSON.parse(localStorage.getItem('domesticFlights') || '[]');
      
      console.log('📊 국제선 데이터 수:', internationalFlights.length);
      console.log('📊 국내선 데이터 수:', domesticFlights.length);
      
      const allFlights = [...internationalFlights, ...domesticFlights];
      const results: any[] = [];
      
      // 검색어와 매칭되는 항공편 찾기
      for (const flight of allFlights) {
        const flightNumber = flight.flightNumber || '';
        const hasMatch = flightNumber.toLowerCase().includes(query.toLowerCase());
        
        if (hasMatch) {
          console.log('✅ 매칭된 항공편:', flight);
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
      
      console.log('🎯 최종 매칭 결과:', results);
      return results;
      
    } catch (error) {
      console.error('로컬 데이터베이스 검색 오류:', error);
      return [];
    }
  };

  // 구글 스프레드시트 데이터를 로컬 데이터베이스에 동기화 (버전 비교 후 최신일 때만)
  const syncGoogleSheetsToLocalDB = async () => {
    try {
      console.log('🔄 구글 스프레드시트 데이터 동기화 시작');
      
      // 한국공항공사 공개 게시된 스프레드시트 링크 (API 키 불필요)
      const INTERNATIONAL_PUBLISHED_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQXqM6gsOYJ2W2_blrOtc2m8J-VfOl8QB0Zivbn_9F28te1v7LI8QiL4YFuotwDhpnmtyNDbvy2UvRl/pubhtml?gid=495590094&single=true';
      const DOMESTIC_PUBLISHED_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQiJ3470gAonQ0jEfsIxidwH17521WPqz0Aa9rm-27sRROB9wfPqiLJqiRr_ch_x-7DSMgHpPYyN0ki/pubhtml?gid=2000046295&single=true';
      
      // CSV 형태로 데이터 가져오기 (공개 링크)
      const internationalCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQXqM6gsOYJ2W2_blrOtc2m8J-VfOl8QB0Zivbn_9F28te1v7LI8QiL4YFuotwDhpnmtyNDbvy2UvRl/pub?output=csv&gid=495590094';
      const domesticCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQiJ3470gAonQ0jEfsIxidwH17521WPqz0Aa9rm-27sRROB9wfPqiLJqiRr_ch_x-7DSMgHpPYyN0ki/pub?output=csv&gid=2000046295';
      
      console.log('🔗 구글 스프레드시트 동기화 시작 (국제선 + 국내선)');
      
      // 1단계: 국제선 CSV 데이터 가져오기
      console.log('🌍 국제선 CSV 데이터 가져오기 시작');
      const internationalResponse = await fetch(internationalCsvUrl);
      
      if (!internationalResponse.ok) {
        console.error('❌ 국제선 CSV 데이터 가져오기 오류:', internationalResponse.status);
        return false;
      }
      
      const internationalCsvText = await internationalResponse.text();
      console.log('📊 국제선 CSV 원본 데이터:', internationalCsvText.substring(0, 200) + '...');
      
      // 2단계: 국내선 CSV 데이터 가져오기
      console.log('🇰🇷 국내선 CSV 데이터 가져오기 시작');
      const domesticResponse = await fetch(domesticCsvUrl);
      
      if (!domesticResponse.ok) {
        console.error('❌ 국내선 CSV 데이터 가져오기 오류:', domesticResponse.status);
        return false;
      }
      
      const domesticCsvText = await domesticResponse.text();
      console.log('📊 국내선 CSV 원본 데이터:', domesticCsvText.substring(0, 200) + '...');
      
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
      
      console.log('✅ 한국공항공사 구글 스프레드시트 데이터 동기화 완료');
      console.log('📊 국제선 데이터 수:', internationalFlights.length);
      console.log('📊 국내선 데이터 수:', domesticFlights.length);
      console.log('📅 동기화 시간 기록:', new Date().toISOString());
      
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
        
        // UI 업데이트를 최소화하여 성능 향상
        setFlights(prev => [...prev, ...chunk]);
        
        // 청크 간 지연으로 브라우저 응답성 유지
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error('나머지 데이터 처리 오류:', error);
    }
  };

  // 오프라인 데이터 로드
  useEffect(() => {
    if (user?.uid) {
      const cachedFlights = simpleCache.loadFlights(user.uid);
      if (cachedFlights && cachedFlights.length > 0) {
        setFlights(cachedFlights);
      }
    }
  }, [user]);

  // 초기 데이터 로딩
  const fetchInitialData = useCallback(async () => {
    if (!user?.uid) return;

    try {
      setIsLoading(true);
      
      // Firebase 데이터 가져오기
      console.log('🔥 Firebase 데이터 가져오기 시도');
      console.log('👤 사용자 ID:', user.uid);
      console.log('🔐 Firebase 인증 상태:', auth.currentUser ? '인증됨' : '인증 안됨');
      
      if (!auth.currentUser) {
        console.log('⚠️ Firebase 인증되지 않음');
        setFlights([]);
        return;
      }
      
      console.log('✅ Firebase 인증 확인됨, 데이터 가져오기 시작');
      const firebaseFlights = await getAllFlights(user.uid);
      
      if (firebaseFlights && firebaseFlights.length > 0) {
        console.log(`✅ Firebase에서 ${firebaseFlights.length}개 비행 데이터 가져옴`);
        
        // 데이터를 작은 청크로 나누어 처리
        const CHUNK_SIZE = 500;
        const firstChunk = firebaseFlights.slice(0, CHUNK_SIZE);
        setFlights(firstChunk);
        
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
        console.log('⚠️ Firebase에 비행 데이터 없음');
        // IndexedDB에서 캐시된 데이터 로드
        const cachedFlights = await indexedDBCache.loadFlights(user.uid);
        if (cachedFlights && cachedFlights.length > 0) {
          setFlights(cachedFlights);
        } else {
          setFlights([]);
        }
      }
    } catch (error) {
      console.error('데이터 로딩 오류:', error);
      // IndexedDB에서 캐시된 데이터 로드 시도
      try {
        const cachedFlights = await indexedDBCache.loadFlights(user.uid);
        if (cachedFlights && cachedFlights.length > 0) {
          setFlights(cachedFlights);
        }
      } catch (cacheError) {
        console.warn('⚠️ 캐시 로드도 실패:', cacheError);
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

  // 네트워크 상태 감지
  useEffect(() => {
    const unsubscribe = networkDetector.subscribe((status) => {
      setIsOffline(!status.isOnline);
      
      if (status.isOnline && user) {
        handleSyncWhenOnline();
      }
    });

    return unsubscribe;
  }, [user, handleSyncWhenOnline]);

  // 초기 데이터 로딩
  useEffect(() => {
    if (user && user.uid) {
      fetchInitialData();
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

  // 인증 상태 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      if (!user) {
        setFlights([]);
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // 파일 업로드 핸들러
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (fileExtension !== 'xls' && fileExtension !== 'xlsx') {
      setUploadError('Excel 파일(.xls, .xlsx)만 업로드 가능합니다.');
      setTimeout(() => setUploadError(''), 5000);
      return;
    }

    try {
      setIsUploading(true);
      setUploadError('');
      
      const newFlights = await parseExcelFile(file);
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      
      await replaceMonthDataWithStatusPreservation(newFlights, user.uid, year, month);
      
      // 업데이트된 데이터 다시 로드
      const updatedFlights = await getAllFlights(user.uid);
      setFlights(updatedFlights);
      
      setUploadMessage('파일이 성공적으로 업로드되었습니다.');
      setTimeout(() => setUploadMessage(''), 3000);
      
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

  // 비행 상태 업데이트 핸들러
  const handleUpdateFlightStatus = async (flightId: string, statusToToggle: 'departed' | 'landed') => {
    if (!user?.uid) return;

    const originalFlights = flights;
    
    try {
      const updatedFlights = flights.map(flight => {
        if (flight.id === flightId) {
          return {
            ...flight,
            [statusToToggle]: !flight[statusToToggle]
          };
        }
        return flight;
      });
      
      setFlights(updatedFlights);
      
      if (user.uid) {
        const flightToUpdate = updatedFlights.find(f => f.id === flightId);
        if (flightToUpdate) {
          const dataToUpdate = {
            [statusToToggle]: flightToUpdate[statusToToggle],
            lastModified: new Date().toISOString()
          };
          await updateFlight(flightId, dataToUpdate, user.uid);
        }
      }
    } catch (error) {
      console.error('비행 상태 업데이트 오류:', error);
      setFlights(originalFlights);
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
      await loginUser(email, password);
      setIsLoginModalOpen(false);
    } catch (error: any) {
      setLoginError(error.message || '로그인에 실패했습니다.');
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
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

  const handleRegister = async (email: string, password: string, displayName: string) => {
    setIsRegisterLoading(true);
    setRegisterError('');
    
    try {
      await registerUser(email, password, displayName);
      setIsRegisterModalOpen(false);
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

  // 비행 카드 클릭 핸들러
  const handleFlightCardClick = (flight: Flight, type: 'last' | 'next') => {
    if (!flight) {
      setNoFlightModal({ isOpen: true, type });
      return;
    }
    setSelectedFlight(flight);
  };

  // 모달 관련 핸들러들
  const handleCalendarClick = () => {
    setIsCalendarModalOpen(true);
  };

  const handleCalendarClose = () => {
    setIsCalendarModalOpen(false);
  };

  const handleCalendarFlightClick = (flight: Flight) => {
    setIsCalendarModalOpen(false);
    setSelectedFlight(flight);
  };

  const handleMonthClick = (month: number) => {
    // 해당 월의 비행 데이터 필터링
    const monthFlights = flights.filter(flight => {
      const flightDate = new Date(flight.date);
      return flightDate.getMonth() === month;
    });

    // BlockTimeCard의 getDutyTime 로직을 여기로 가져옴
    const getDutyTime = (monthFlights: Flight[]): string => {
      if (monthFlights.length === 0) {
        return '00:00';
      }

      // 해당 월의 첫 번째 비행에서 monthlyTotalBlock 확인
      const flightWithDuty = monthFlights.find(flight => flight.monthlyTotalBlock && flight.monthlyTotalBlock > 0);
      if (flightWithDuty && flightWithDuty.monthlyTotalBlock) {
        const totalHours = flightWithDuty.monthlyTotalBlock;
        const hours = Math.floor(totalHours);
        const minutes = Math.round((totalHours - hours) * 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }

      // monthlyTotalBlock이 없으면 00:00 반환
      return '00:00';
    };

    const blockTime = getDutyTime(monthFlights);
    setMonthlyModalData({ month, flights: monthFlights, blockTime });
  };

  const handleCurrencyCardClick = (type: 'takeoff' | 'landing', currencyInfo: CurrencyInfo) => {
    setCurrencyModalData({ 
      title: type === 'takeoff' ? '이륙' : '착륙', 
      events: currencyInfo.recentEvents 
    });
  };

  const handleCurrencyFlightClick = (flight: Flight) => {
    setCurrencyModalData(null);
    setSelectedFlight(flight);
  };

  const handleCrewMemberClick = (crewName: string) => {
    const flightsWithCrew = flights.filter(f => f.crew && f.crew.includes(crewName));
    setSelectedCrewName(crewName);
    setFlightsWithSelectedCrew(flightsWithCrew);
    setIsCrewHistoryModalOpen(true);
  };

  const handleCrewHistoryModalClose = () => {
    setIsCrewHistoryModalOpen(false);
    setSelectedCrewName('');
    setFlightsWithSelectedCrew([]);
  };

  const handleCrewHistoryFlightClick = (flight: Flight) => {
    handleCrewHistoryModalClose();
    setSelectedFlight(flight);
  };

  const handleUserSettingsClick = () => {
    setIsUserSettingsModalOpen(true);
  };

  const handleUserSettingsClose = () => {
    setIsUserSettingsModalOpen(false);
  };

  const handleNoFlightModalClose = () => {
    setNoFlightModal({ isOpen: false, type: 'last' });
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
  const { lastFlight, nextFlight } = findLastAndNextFlights(flights, todayStr);
  const takeoffCurrency = calculateCurrency(flights, 'takeoff', todayStr);
  const landingCurrency = calculateCurrency(flights, 'landing', todayStr);

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
              비행 스케줄을 관리하세요
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
            <p>My KneeBoard © 2025.</p>
          </footer>
        </div>
      ) : (
        // ---------- 2. 로그인했을 때의 대시보드 화면 ----------
        <div className="container mx-auto p-4 md:p-6 lg:p-8 flex flex-col">
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
          <header className="mb-4 flex justify-between items-center gap-2 sm:gap-4">
            {/* Left: User Info */}
            <div className="flex-1 flex justify-start">
              <div className="flex flex-col items-start gap-1">
                <span className="text-base font-semibold text-gray-700 dark:text-gray-300">
                  {user.displayName}님
                </span>
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
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xls,.xlsx"/>
                <button 
                  onClick={handleUploadClick} 
                  disabled={isUploading} 
                  title="Upload Excel Schedule" 
                  className="p-1.5 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UploadCloudIcon className={`w-6 h-6 ${isUploading ? 'animate-spin' : ''}`} />
                </button>
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 text-right">
                  <p>{todayDatePart}</p>
                  <p>{todayWeekdayPart}(KST) 기준</p>
                </div>
              </div>
            </div>
          </header>

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
                onClick={() => setActiveTab('dashboard')}
                className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'dashboard'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('rest')}
                className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'rest'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Rest
              </button>
              <button
                onClick={() => setActiveTab('flightData')}
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
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-300">월별 비행 시간 (Block)</h2>
                  <button
                    onClick={handleCalendarClick}
                    className="flex items-center justify-center p-2 text-blue-600 hover:text-blue-700 transition-colors rounded-lg"
                    title="전체 달력 보기"
                  >
                    <CalendarIcon className="w-5 h-5" />
                  </button>
                </div>
                <BlockTimeCard flights={flights} todayStr={todayStr} onMonthClick={handleMonthClick} />
              </section>

              <section className="mb-8 grid grid-cols-2 gap-6 sm:gap-8">
                <FlightCard flight={lastFlight} type="last" onClick={handleFlightCardClick} todayStr={todayStr} />
                <FlightCard flight={nextFlight} type="next" onClick={handleFlightCardClick} todayStr={todayStr} />
              </section>

              <section>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-300 mb-4">이착륙 자격 현황</h2>
                <div className="grid grid-cols-2 gap-6">
                  <CurrencyCard title="이륙" currencyInfo={takeoffCurrency} onClick={() => handleCurrencyCardClick('takeoff', takeoffCurrency)} />
                  <CurrencyCard title="착륙" currencyInfo={landingCurrency} onClick={() => handleCurrencyCardClick('landing', landingCurrency)} />
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
            <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'} p-6 rounded-lg`}>
              {/* Flight Data 섹션 */}
              <section className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-300">Flight Data</h2>
                </div>
                
                {/* 검색 카드 그리드 */}
                <div className="grid grid-cols-2 gap-6 mb-8">
                  {/* 항공편 검색 카드 */}
                  <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-sm border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} hover:shadow-md transition-shadow`}>
                    <div className="mb-4">
                      <div className="font-semibold text-gray-700 dark:text-gray-300">항공편 검색</div>
                    </div>
                    <div className="mb-4">
                      <input
                        type="text"
                        placeholder="항공편명 입력"
                        value={flightSearchQuery}
                        onChange={(e) => setFlightSearchQuery(e.target.value.toUpperCase())}
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
                  <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-sm border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} hover:shadow-md transition-shadow`}>
                    <div className="mb-4">
                      <div className="font-semibold text-gray-700 dark:text-gray-300">항공사 정보</div>
                    </div>
                    <div className="mb-4">
                      <input
                        type="text"
                        placeholder="IATA/ICAO 코드 입력"
                        value={airlineSearchQuery}
                        onChange={(e) => setAirlineSearchQuery(e.target.value.toUpperCase())}
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
                <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} p-6 mb-6`}>
                                      <div className="mb-6">
                      <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">항공편 검색 결과</h3>
                    </div>
                                         {!isOnline && (
                       <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                         <p className="text-sm text-blue-700 dark:text-blue-300">
                           📡 오프라인 모드: Firebase 캐시에서 항공편 정보를 검색합니다
                         </p>
                       </div>
                     )}
                  
                  {/* 항공편 검색 결과 */}
                  {flightSearchResults.length > 0 ? (
                    flightSearchResults.map((flight, index) => (
                      <div key={index} className={`${isDarkMode ? 'bg-gradient-to-br from-gray-700 to-gray-800' : 'bg-gradient-to-br from-gray-50 to-white'} p-6 rounded-xl shadow-md border ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} hover:shadow-lg transition-all duration-300 mb-4`}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4c-1 0-2 0-3.5 1.5L12 9l-8.2-1.8c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 2.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
                            </svg>
                            <h4 className="text-lg font-bold text-gray-700 dark:text-gray-300">{flight.flightNumber}</h4>
                            {flight.hasDetailedSchedule && (
                              <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                                (ICAO: {getICAOCode(flight.airline)})
                              </span>
                            )}
                          </div>
                          <span className="px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold rounded-full shadow-sm">{flight.type}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                              <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">출발</div>
                              <div className="font-semibold text-gray-700 dark:text-gray-300">{flight.origin || flight.departure}</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">도착</div>
                              <div className="font-semibold text-gray-700 dark:text-gray-300">{flight.destination || flight.arrival}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            <span className="text-gray-500 dark:text-gray-400">시간:</span>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{flight.time}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            <span className="text-gray-500 dark:text-gray-400">기종:</span>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{flight.aircraft}</span>
                          </div>
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
                                             <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'} mt-2`}>
                         {isOnline ? 'Amadeus API에서 항공편 정보를 검색합니다' : 'Firebase 캐시에서 항공편 정보를 검색합니다'}
                       </p>
                    </div>
                  )}
                </div>
                )}

                {/* 항공사 정보 검색 결과 섹션 */}
                {showAirlineResults && (
                <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} p-6`}>
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">항공사 정보 검색 결과</h3>
                  </div>
                  
                                    {/* 항공사 정보 결과 */}
                  {airlineSearchResults.length > 0 ? (
                    airlineSearchResults.map((airline, index) => (
                      <div key={index} className={`${isDarkMode ? 'bg-gradient-to-br from-gray-700 to-gray-800' : 'bg-gradient-to-br from-gray-50 to-white'} p-6 rounded-xl shadow-md border ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} hover:shadow-lg transition-all duration-300 mb-4`}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                            </div>
                            <div>
                              <h4 className="text-lg font-bold text-gray-700 dark:text-gray-300">{airline.name}</h4>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{airline.koreanName}</p>
                            </div>
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
                            <div className="font-bold text-gray-700 dark:text-gray-300 text-sm break-words">{airline.country}</div>
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
            <p>My KneeBoard © 2025.</p>
          </footer>
        </div>
      )}

      {/* ---------- 3. 모든 모달들은 공통으로 맨 마지막에 렌더링 ---------- */}
      <FlightDetailModal 
        flight={selectedFlight} 
        onClose={() => setSelectedFlight(null)} 
        onUpdateStatus={handleUpdateFlightStatus}
        flightType={selectedFlight && flights.find(f => f.id === selectedFlight.id) ? 
          (flights.indexOf(flights.find(f => f.id === selectedFlight.id)!) < flights.findIndex(f => new Date(f.date) >= new Date(todayStr)) ? 'last' : 'next') : 
          undefined}
        currentUser={user}
        onCrewClick={handleCrewMemberClick}
        onAirportClick={handleAirportClick}
      />
      <CurrencyDetailModal 
        data={currencyModalData} 
        onClose={() => setCurrencyModalData(null)} 
        onFlightClick={handleCurrencyFlightClick}
      />
      <MonthlyScheduleModal 
        data={monthlyModalData} 
        onClose={() => setMonthlyModalData(null)} 
        onFlightClick={(flight) => setSelectedFlight(flight)}
      />
      <CalendarModal
        isOpen={isCalendarModalOpen}
        onClose={handleCalendarClose}
        flights={flights}
        month={new Date().getMonth() + 1}
        year={new Date().getFullYear()}
        onFlightClick={handleCalendarFlightClick}
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
      <UserSettingsModal 
        isOpen={isUserSettingsModalOpen}
        onClose={handleUserSettingsClose}
        currentUser={user}
        theme={theme}
        setTheme={setTheme}
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
      />
      <CityScheduleModal
        isOpen={isCityScheduleModalOpen}
        onClose={() => setIsCityScheduleModalOpen(false)}
        city={selectedCityForSchedule}
        flights={flights.filter(f => f.route && f.route.includes(selectedCityForSchedule || ''))}
        onFlightClick={(flight) => {
          setIsCityScheduleModalOpen(false);
          setSelectedFlight(flight);
        }}
      />
    </div>
  );
};

export default App;

