
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
