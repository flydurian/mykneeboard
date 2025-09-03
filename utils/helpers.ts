
import { Flight, DDayInfo, CurrencyInfo } from '../types';
import { toZonedTime, format } from 'date-fns-tz';
import { getCityInfo } from './cityData';

export const calculateDday = (flightDateStr: string, todayStr: string, std?: string): DDayInfo => {
  const KOREA_TIME_ZONE = 'Asia/Seoul';

  // 한국 시간 기준으로 날짜만 비교
  const todayInKST = toZonedTime(`${todayStr}T00:00:00`, KOREA_TIME_ZONE);
  const flightDateInKST = toZonedTime(`${flightDateStr}T00:00:00`, KOREA_TIME_ZONE);
  
  // 날짜 차이 계산 (시간은 무시하고 날짜만 비교)
  const diffTime = flightDateInKST.getTime() - todayInKST.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  

  
  if (diffDays === 0) {
    return { text: '오늘', days: 0 };
  }
  if (diffDays === 1) return { text: '내일', days: 1 };
  if (diffDays > 0) return { text: `${diffDays}일 후`, days: diffDays };
  if (diffDays === -1) return { text: '어제', days: -1 };
  return { text: `${Math.abs(diffDays)}일 전`, days: diffDays };
};

export const calculateCurrency = (flights: Flight[], type: 'takeoff' | 'landing', todayStr: string): CurrencyInfo => {
    const KOREA_TIME_ZONE = 'Asia/Seoul';
    const today = toZonedTime(`${todayStr}T00:00:00`, KOREA_TIME_ZONE);
    const ninetyDaysAgo = toZonedTime(`${todayStr}T00:00:00`, KOREA_TIME_ZONE);
    ninetyDaysAgo.setDate(today.getDate() - 90);

    const recentEvents = flights
      .filter(f => {
        const flightDate = toZonedTime(`${f.date}T00:00:00`, KOREA_TIME_ZONE);
        return flightDate >= ninetyDaysAgo && flightDate <= today;
      })
      .filter(f => type === 'takeoff' ? f.status.departed : f.status.landed)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const count = recentEvents.length;
    const isCurrent = count >= 3;
    let expiryDate: string | null = null;
    let daysUntilExpiry: number | null = null;

    if (isCurrent) {
        const thirdEventDate = new Date(recentEvents[2].date);
        const expiryDateObj = new Date(thirdEventDate);
        expiryDateObj.setDate(thirdEventDate.getDate() + 90);
        expiryDate = expiryDateObj.toLocaleDateString('ko-KR');
        daysUntilExpiry = Math.ceil((expiryDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
    return { count, isCurrent, expiryDate, daysUntilExpiry, recentEvents };
};

export const findLastAndNextFlights = (flights: Flight[], todayStr: string): { lastFlight: Flight | undefined, nextFlight: Flight | undefined } => {
    if (!flights || flights.length === 0) {
        return { lastFlight: undefined, nextFlight: undefined };
    }

    // 항공편 번호가 숫자로 되어 있고, route 정보도 있는 경우를 "실제 비행"으로 간주
    const isActualFlight = (flight: Flight) => 
        flight.flightNumber && /^\d+$/.test(flight.flightNumber) && flight.route && flight.route.trim() !== '';

    const sortedFlights = [...flights]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const actualFlights = sortedFlights.filter(isActualFlight);

    const pastFlights: Flight[] = [];
    const futureFlights: Flight[] = [];

    // 각 비행편의 출발 시간을 출발지 로컬 시간으로 계산하여 과거/미래 구분
    actualFlights.forEach(flight => {
        if (!flight.std || !flight.route) {
            // 출발 시간이나 노선 정보가 없는 경우 한국 시간 기준으로 판단
            const KOREA_TIME_ZONE = 'Asia/Seoul';
            const now = new Date();
            const koreaNow = toZonedTime(now, KOREA_TIME_ZONE);
            const flightDate = toZonedTime(`${flight.date}T00:00:00`, KOREA_TIME_ZONE);
            
            if (flightDate.getTime() < koreaNow.getTime()) {
                pastFlights.push(flight);
            } else {
                futureFlights.push(flight);
            }
        } else {
            // 출발지 로컬 시간 기준으로 판단
            try {
                const departureAirport = flight.route.split('/')[0];
                const cityInfo = getCityInfo(departureAirport);
                
                if (cityInfo) {
                    // 출발지 현지 시간으로 출발 시점 계산
                    const [hours, minutes] = flight.std.split(':').map(Number);
                    const departureDateTime = new Date(flight.date);
                    departureDateTime.setHours(hours, minutes, 0, 0);
                    
                    // 출발지 현지 시간으로 변환
                    const localDepartureDateTime = new Date(departureDateTime.toLocaleString("en-US", { timeZone: cityInfo.timezone }));
                    
                    // 현재 출발지 현지 시간
                    const now = new Date();
                    const localNow = new Date(now.toLocaleString("en-US", { timeZone: cityInfo.timezone }));
                    
                    if (localDepartureDateTime.getTime() <= localNow.getTime()) {
                        // 출발지 현지 시간 기준으로 출발 시간이 지난 경우
                        pastFlights.push(flight);
                    } else {
                        // 출발지 현지 시간 기준으로 출발 시간이 아직 오지 않은 경우
                        futureFlights.push(flight);
                    }
                } else {
                    // 도시 정보가 없는 경우 한국 시간 기준으로 판단
                    const KOREA_TIME_ZONE = 'Asia/Seoul';
                    const now = new Date();
                    const koreaNow = toZonedTime(now, KOREA_TIME_ZONE);
                    const [hours, minutes] = flight.std.split(':').map(Number);
                    const flightDateTime = toZonedTime(`${flight.date}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`, KOREA_TIME_ZONE);
                    
                    if (flightDateTime.getTime() <= koreaNow.getTime()) {
                        pastFlights.push(flight);
                    } else {
                        futureFlights.push(flight);
                    }
                }
            } catch (error) {
                console.error('출발지 현지 시간 계산 오류:', error);
                // 오류 발생 시 한국 시간 기준으로 판단
                const KOREA_TIME_ZONE = 'Asia/Seoul';
                const now = new Date();
                const koreaNow = toZonedTime(now, KOREA_TIME_ZONE);
                const [hours, minutes] = flight.std.split(':').map(Number);
                const flightDateTime = toZonedTime(`${flight.date}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`, KOREA_TIME_ZONE);
                
                if (flightDateTime.getTime() <= koreaNow.getTime()) {
                    pastFlights.push(flight);
                } else {
                    futureFlights.push(flight);
                }
            }
        }
    });

    return {
        lastFlight: pastFlights.pop(), // 배열의 마지막 항목 (가장 최근 과거 비행)
        nextFlight: futureFlights[0]   // 배열의 첫 항목 (가장 가까운 미래 비행)
    };
};

export const formatTime = (totalMinutes: number): string => {
    if (totalMinutes === 0) return '00:00';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// ✨ 이착륙 기록을 보존하는 스마트 병합 함수
export const mergeFlightDataWithStatusPreservation = (
  existingFlights: Flight[], 
  newFlights: Flight[]
): Flight[] => {


  const mergedFlights: Flight[] = [];
  const processedExistingIds = new Set<number>();

  // 새로운 데이터를 기준으로 처리
  for (const newFlight of newFlights) {
    // 같은 날짜, 같은 비행편 번호를 가진 기존 데이터 찾기
    const existingFlight = existingFlights.find(existing => 
      existing.date === newFlight.date && 
      existing.flightNumber === newFlight.flightNumber
    );

    if (existingFlight) {
      // ✨ 기존 이착륙 상태 보존하면서 새로운 정보 업데이트
      const mergedFlight: Flight = {
        ...newFlight, // 새로운 스케줄 정보 (시간, 크루, 노선 등)
        // ✨ 기존 데이터에 status나 lastModified가 없을 경우를 대비하여 기본값 제공
        status: existingFlight.status || { departed: false, landed: false },
        lastModified: existingFlight.lastModified || new Date().toISOString(),
        version: existingFlight.version || 0 // 기존 버전 유지
      };

      /*
      console.log('이착륙 상태 보존 병합:', {
        날짜: newFlight.date,
        비행편: newFlight.flightNumber,
        기존상태: existingFlight.status,
        새로운정보: {
          std: newFlight.std,
          sta: newFlight.sta,
          crew: newFlight.crew?.length || 0
        }
      });
      */

      mergedFlights.push(mergedFlight);
      processedExistingIds.add(existingFlight.id);
    } else {
      // ✨ 새로운 비행편이므로 필수 필드와 함께 추가
      mergedFlights.push({
        ...newFlight,
        status: newFlight.status || { departed: false, landed: false },
        lastModified: new Date().toISOString(),
        version: 0
      });
  
    }
  }

  // 새로운 데이터에 없는 기존 데이터도 유지 (삭제된 스케줄이 아닌 경우) -> 이 로직이 문제의 원인
  /*
  for (const existingFlight of existingFlights) {
    if (!processedExistingIds.has(existingFlight.id)) {
      // 새로운 데이터에 없는 기존 데이터는 유지
      mergedFlights.push(existingFlight);
  
    }
  }
  */

  /*
  console.log('스마트 병합 완료:', {
    최종데이터: mergedFlights.length,
    보존된이착륙기록: mergedFlights.filter(f => f.status.departed || f.status.landed).length
  });
  */

  return mergedFlights;
};

// ✨ 월별 데이터 교체 함수 (이착륙 상태 보존)
export const replaceMonthDataWithStatusPreservation = async (
  newFlights: Flight[], 
  userId: string,
  targetYear: number,
  targetMonth: number
): Promise<void> => {
  try {
  

    // 1. 기존 해당 월 데이터 가져오기
    const { getFlightsByMonth } = await import('../src/firebase/database');
    const existingFlights = await getFlightsByMonth(targetYear, targetMonth, userId);

    // 2. 스마트 병합 실행
    const mergedFlights = mergeFlightDataWithStatusPreservation(existingFlights, newFlights);

    // 3. 기존 월 데이터 삭제
    const { deleteData } = await import('../src/firebase/database');
    const monthPath = `users/${userId}/flights/${targetYear}/${targetMonth.toString().padStart(2, '0')}`;
    await deleteData(monthPath);

    // 4. 병합된 데이터 저장
    const { addMultipleFlights } = await import('../src/firebase/database');
    await addMultipleFlights(mergedFlights, userId);

    /*
    console.log('월별 데이터 교체 완료:', {
      기존데이터: existingFlights.length,
      새로운데이터: newFlights.length,
      병합된데이터: mergedFlights.length
    });
    */

  } catch (error) {
    console.error('월별 데이터 교체 실패:', error);
    throw error;
  }
};
