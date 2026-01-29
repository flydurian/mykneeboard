
export interface CrewMember {
  empl: string;
  name: string;
  rank: string;
  posnType: string;
  posn: string;
  gisu?: string;
}

export interface FlightStatus {
  departed: boolean;
  landed: boolean;
}

export interface Flight {
  id: number;
  date: string; // 기본 날짜 (출발일)
  departureDateTimeUtc?: string; // 출발일시 UTC (ISO 8601 형식: 2025-05-10T18:05:00Z)
  arrivalDateTimeUtc?: string; // 도착일시 UTC (ISO 8601 형식: 2025-05-11T06:05:00Z)
  showUpDateTimeUtc?: string; // Show Up 시간 UTC (ISO 8601 형식: 2025-05-10T16:45:00Z)
  flightNumber: string;
  route: string;
  std?: string; // Scheduled Time of Departure (출발 예정 시간)
  sta?: string; // Scheduled Time of Arrival (도착 예정 시간)
  block: number;
  status: FlightStatus;
  crew: CrewMember[];
  cabinCrew?: CrewMember[]; // 객실 승무원 목록
  monthlyTotalBlock?: string; // 월별 총 BLOCK 시간 (HH:MM 형식)
  lastModified?: string; // 최종 수정 시간 (ISO 문자열)
  lastUpdated?: string; // Firebase 저장용 최종 업데이트 시간 (ISO 문자열)
  version?: number; // 데이터 버전
  scheduleType?: string; // 스케줄 타입 (FLIGHT, RDO, OTHRDUTY, STANDBY 등)
  acType?: string; // 항공기 타입 (A/C Type)
  regNo?: string; // 등록 번호 (Registration Number)
  isBriefingInfo?: boolean; // 브리핑 인포 파일 여부
  _storagePath?: { // Firebase 저장 경로 정보
    year: number;
    month: string;
    firebaseKey: string;
  };
  // Cache 및 호환성을 위한 선택적 속성
  airline?: string;
  departure?: string;
  arrival?: string;
  time?: string;
  aircraft?: string;
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
  graphEvents?: Flight[]; // 그래프용 6개월 데이터
}

export interface MonthlyModalData {
  month: number;
  year: number;
  flights: Flight[];
  blockTime: string;
}

// 항공편 스케줄 데이터 타입
export interface FlightSchedule {
  airlineFlightNumber: string;  // 항공편 번호 (예: KE1001, OZ1001)
  route: string;                // 경로 (예: ICN/IST, IST/ICN)
  std: string;                  // Scheduled Time of Departure (출발 예정 시간)
  sta: string;                  // Scheduled Time of Arrival (도착 예정 시간)
}

// 압축된 스케줄 데이터 타입 (배열 형태)
export type CompressedFlightSchedule = [string, string]; // [항공편번호, 경로]

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

