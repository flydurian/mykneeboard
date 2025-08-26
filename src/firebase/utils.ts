import { getFlightsByMonth, subscribeToFlightsByMonth } from './database';

// 월별 데이터 구조 정보
export interface MonthData {
  year: number;
  month: number;
  flightCount: number;
  totalBlockTime: number;
}

// 특정 월의 데이터 요약 정보 가져오기
export const getMonthSummary = async (year: number, month: number): Promise<MonthData | null> => {
  try {
    const monthFlights = await getFlightsByMonth(year, month);
    if (!monthFlights) return null;
    
    const flights = Object.values(monthFlights);
    const totalBlockTime = flights.reduce((sum: number, flight: any) => sum + (flight.blockTime || 0), 0);
    
    return {
      year,
      month,
      flightCount: flights.length,
      totalBlockTime
    };
  } catch (error) {
    console.error('Error getting month summary:', error);
    return null;
  }
};

// 월별 데이터 구독 (특정 월의 변경사항만 감지)
export const subscribeToMonthData = (year: number, month: number, callback: (data: any) => void) => {
  return subscribeToFlightsByMonth(year, month, callback);
};

// 날짜에서 연도와 월 추출
export const extractYearMonth = (dateString: string) => {
  const date = new Date(dateString);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1
  };
};

// 월별 경로 생성 (YYYY/MM 형식)
export const createMonthPath = (year: number, month: number) => {
  return `${year}/${month.toString().padStart(2, '0')}`;
};
