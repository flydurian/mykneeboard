// ============================================================================
// 도시 정보 데이터 구조
// ============================================================================

export interface CityInfo {
  code: string;           // 공항 코드 (예: ICN, JFK)
  icao: string;          // ICAO 코드 (예: RKSI, KJFK)
  name: string;          // 도시 이름 (예: Incheon, New York)
  timezone: string;      // IANA 타임존 (예: Asia/Seoul, America/New_York)
  currency: string;      // 통화 코드 (예: KRW, USD)
  country: string;       // 국가 이름
}

// ============================================================================
// 공항 코드별 도시 정보
// ============================================================================

export const CITY_DATA: Record<string, CityInfo> = {
  // 한국
  ICN: {
    code: 'ICN',
    icao: 'RKSI',
    name: 'Incheon',
    timezone: 'Asia/Seoul',
    currency: 'KRW',
    country: 'South Korea'
  },

  // 미국
  JFK: {
    code: 'JFK',
    icao: 'KJFK',
    name: 'New York',
    timezone: 'America/New_York',
    currency: 'USD',
    country: 'United States'
  },
  LAX: {
    code: 'LAX',
    icao: 'KLAX',
    name: 'Los Angeles',
    timezone: 'America/Los_Angeles',
    currency: 'USD',
    country: 'United States'
  },
  SFO: {
    code: 'SFO',
    icao: 'KSFO',
    name: 'San Francisco',
    timezone: 'America/Los_Angeles',
    currency: 'USD',
    country: 'United States'
  },
  SEA: {
    code: 'SEA',
    icao: 'KSEA',
    name: 'Seattle',
    timezone: 'America/Los_Angeles',
    currency: 'USD',
    country: 'United States'
  },

  // 유럽
  LHR: {
    code: 'LHR',
    icao: 'EGLL',
    name: 'London',
    timezone: 'Europe/London',
    currency: 'GBP',
    country: 'United Kingdom'
  },
  AMS: {
    code: 'AMS',
    icao: 'EHAM',
    name: 'Amsterdam',
    timezone: 'Europe/Amsterdam',
    currency: 'EUR',
    country: 'Netherlands'
  },
  MAD: {
    code: 'MAD',
    icao: 'LEMD',
    name: 'Madrid',
    timezone: 'Europe/Madrid',
    currency: 'EUR',
    country: 'Spain'
  },
  CDG: {
    code: 'CDG',
    icao: 'LFPG',
    name: 'Paris',
    timezone: 'Europe/Paris',
    currency: 'EUR',
    country: 'France'
  },
  FCO: {
    code: 'FCO',
    icao: 'LIRF',
    name: 'Rome',
    timezone: 'Europe/Rome',
    currency: 'EUR',
    country: 'Italy'
  },
  BCN: {
    code: 'BCN',
    icao: 'LEBL',
    name: 'Barcelona',
    timezone: 'Europe/Madrid',
    currency: 'EUR',
    country: 'Spain'
  },
  FRA: {
    code: 'FRA',
    icao: 'EDDF',
    name: 'Frankfurt',
    timezone: 'Europe/Berlin',
    currency: 'EUR',
    country: 'Germany'
  },
  PRG: {
    code: 'PRG',
    icao: 'LKPR',
    name: 'Prague',
    timezone: 'Europe/Prague',
    currency: 'CZK',
    country: 'Czech Republic'
  },

  // 아시아
  NRT: {
    code: 'NRT',
    icao: 'RJAA',
    name: 'Tokyo',
    timezone: 'Asia/Tokyo',
    currency: 'JPY',
    country: 'Japan'
  },
  KIX: {
    code: 'KIX',
    icao: 'RJBB',
    name: 'Osaka',
    timezone: 'Asia/Tokyo',
    currency: 'JPY',
    country: 'Japan'
  },
  HND: {
    code: 'HND',
    icao: 'RJTT',
    name: 'Tokyo',
    timezone: 'Asia/Tokyo',
    currency: 'JPY',
    country: 'Japan'
  },
  HKG: {
    code: 'HKG',
    icao: 'VHHH',
    name: 'Hong Kong',
    timezone: 'Asia/Hong_Kong',
    currency: 'HKD',
    country: 'Hong Kong'
  },
  BKK: {
    code: 'BKK',
    icao: 'VTBS',
    name: 'Bangkok',
    timezone: 'Asia/Bangkok',
    currency: 'THB',
    country: 'Thailand'
  },
  PEK: {
    code: 'PEK',
    icao: 'ZBAA',
    name: 'Beijing',
    timezone: 'Asia/Shanghai',
    currency: 'CNY',
    country: 'China'
  },
  PVG: {
    code: 'PVG',
    icao: 'ZSPD',
    name: 'Shanghai',
    timezone: 'Asia/Shanghai',
    currency: 'CNY',
    country: 'China'
  },
  TPE: {
    code: 'TPE',
    icao: 'RCTP',
    name: 'Taipei',
    timezone: 'Asia/Taipei',
    currency: 'TWD',
    country: 'Taiwan'
  },
  SIN: {
    code: 'SIN',
    icao: 'WSSS',
    name: 'Singapore',
    timezone: 'Asia/Singapore',
    currency: 'SGD',
    country: 'Singapore'
  },
  CGK: {
    code: 'CGK',
    icao: 'WIII',
    name: 'Jakarta',
    timezone: 'Asia/Jakarta',
    currency: 'IDR',
    country: 'Indonesia'
  },
  SGN: {
    code: 'SGN',
    icao: 'VVTS',
    name: 'Ho Chi Minh City',
    timezone: 'Asia/Ho_Chi_Minh',
    currency: 'VND',
    country: 'Vietnam'
  },
  HAN: {
    code: 'HAN',
    icao: 'VVNB',
    name: 'Hanoi',
    timezone: 'Asia/Ho_Chi_Minh',
    currency: 'VND',
    country: 'Vietnam'
  },

  // 오세아니아
  SYD: {
    code: 'SYD',
    icao: 'YSSY',
    name: 'Sydney',
    timezone: 'Australia/Sydney',
    currency: 'AUD',
    country: 'Australia'
  },
  AKL: {
    code: 'AKL',
    icao: 'NZAA',
    name: 'Auckland',
    timezone: 'Pacific/Auckland',
    currency: 'NZD',
    country: 'New Zealand'
  },
  MEL: {
    code: 'MEL',
    icao: 'YMML',
    name: 'Melbourne',
    timezone: 'Australia/Melbourne',
    currency: 'AUD',
    country: 'Australia'
  }
};

// ============================================================================
// 비행 시간 정보
// ============================================================================

export const FLIGHT_TIMES: Record<string, { hours: number; minutes: number }> = {
  'JFK/ICN': { hours: 15, minutes: 40 },
  'ICN/JFK': { hours: 14, minutes: 50 },
  'LAX/ICN': { hours: 12, minutes: 30 },
  'ICN/LAX': { hours: 11, minutes: 40 },
  'LHR/ICN': { hours: 11, minutes: 30 },
  'ICN/LHR': { hours: 10, minutes: 40 },
  'KIX/ICN': { hours: 2, minutes: 0 },
  'ICN/KIX': { hours: 2, minutes: 0 },
  'FCO/ICN': { hours: 10, minutes: 30 },
  'ICN/FCO': { hours: 9, minutes: 40 },
  'TPE/ICN': { hours: 2, minutes: 30 },
  'ICN/TPE': { hours: 2, minutes: 30 },
  'SFO/ICN': { hours: 11, minutes: 30 },
  'ICN/SFO': { hours: 10, minutes: 40 },
  'NRT/ICN': { hours: 2, minutes: 30 },
  'ICN/NRT': { hours: 2, minutes: 30 },
  'BCN/ICN': { hours: 11, minutes: 0 },
  'ICN/BCN': { hours: 10, minutes: 10 },
  'SEA/ICN': { hours: 10, minutes: 30 },
  'ICN/SEA': { hours: 9, minutes: 40 },
  'SIN/ICN': { hours: 6, minutes: 30 },
  'ICN/SIN': { hours: 6, minutes: 30 },
  'CDG/ICN': { hours: 10, minutes: 30 },
  'ICN/CDG': { hours: 9, minutes: 40 }
};

// ============================================================================
// 유틸리티 함수들
// ============================================================================

export const getCityInfo = (airportCode: string): CityInfo | null => {
  return CITY_DATA[airportCode] || null;
};

export const getTimezone = (airportCode: string): string | null => {
  return CITY_DATA[airportCode]?.timezone || null;
};

export const getICAO = (airportCode: string): string | null => {
  return CITY_DATA[airportCode]?.icao || null;
};

export const getCityName = (airportCode: string): string | null => {
  return CITY_DATA[airportCode]?.name || null;
};

export const getCurrency = (airportCode: string): string | null => {
  return CITY_DATA[airportCode]?.currency || null;
};

export const getCountry = (airportCode: string): string | null => {
  return CITY_DATA[airportCode]?.country || null;
};

export const getFlightTime = (route: string): { hours: number; minutes: number } | null => {
  return FLIGHT_TIMES[route] || null;
};

// 모든 공항 코드 목록 가져오기
export const getAllAirportCodes = (): string[] => {
  return Object.keys(CITY_DATA);
};

// 특정 국가의 공항 코드들 가져오기
export const getAirportsByCountry = (country: string): string[] => {
  return Object.entries(CITY_DATA)
    .filter(([_, cityInfo]) => cityInfo.country === country)
    .map(([code, _]) => code);
};

// 특정 통화를 사용하는 공항 코드들 가져오기
export const getAirportsByCurrency = (currency: string): string[] => {
  return Object.entries(CITY_DATA)
    .filter(([_, cityInfo]) => cityInfo.currency === currency)
    .map(([code, _]) => code);
};

// ============================================================================
// API 설정
// ============================================================================

// 환율 API 키
export const EXCHANGE_API_KEY = "864fe3093746e3b623bd50a9";

// 환율 API URL 생성 함수
export const getExchangeRateUrl = (fromCurrency: string, toCurrency: string = 'KRW'): string => {
  return `https://v6.exchangerate-api.com/v6/${EXCHANGE_API_KEY}/pair/${fromCurrency}/${toCurrency}`;
};

// UTC 오프셋 계산 함수
export const getUTCOffset = (airportCode: string): string | null => {
  const cityInfo = CITY_DATA[airportCode];
  if (!cityInfo) return null;
  
  try {
    const now = new Date();
    const utcTime = new Date(now.toLocaleString("en-US", {timeZone: "UTC"}));
    const localTime = new Date(now.toLocaleString("en-US", {timeZone: cityInfo.timezone}));
    const offset = (localTime.getTime() - utcTime.getTime()) / (1000 * 60 * 60);
    
    if (offset === 0) return '(UTC)';
    if (offset > 0) return `(UTC+${offset})`;
    return `(UTC${offset})`;
  } catch (error) {
    return null;
  }
};
