
export interface CrewMember {
  empl: string;
  name: string;
  rank: string;
  posnType: string;
  posn: string;
}

export interface FlightStatus {
  departed: boolean;
  landed: boolean;
}

export interface Flight {
  id: number;
  date: string;
  flightNumber: string;
  route: string;
  std: string;
  sta: string;
  block: number;
  status: FlightStatus;
  crew: CrewMember[];
  monthlyTotalBlock?: number; // 월별 총 BLOCK 시간
  lastModified?: string; // 최종 수정 시간 (ISO 문자열)
  version?: number; // 데이터 버전
}

export interface DDayInfo {
    text: string;
    days: number;
}

export interface CurrencyInfo {
    count: number;
    isCurrent: boolean;
    expiryDate: string | null;
    daysUntilExpiry: number | null;
    recentEvents: Flight[];
}

export interface CurrencyModalData {
    title: string;
    events: Flight[];
}

export interface MonthlyModalData {
    month: number;
    flights: Flight[];
    blockTime: string;
}

// Firebase 관련 타입 정의
declare global {
  interface Window {
    firebase: {
      app: any;
      analytics: any;
      database: any;
    };
  }
}

// 구글 스프레드시트 항공편 데이터 타입
export interface GoogleSheetFlightData {
  date: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  departureTime: string;
  arrivalTime: string;
  aircraft: string;
  captain: string;
  firstOfficer: string;
  flightTime: string;
  restTime: string;
  notes?: string;
}

// 구글 스프레드시트 메타데이터
export interface GoogleSheetMetadata {
  lastUpdated: string;
  version: string;
  totalRecords: number;
}
