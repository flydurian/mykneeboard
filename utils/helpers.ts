
import { Flight, DDayInfo, CurrencyInfo } from '../types';
import { toZonedTime, format } from 'date-fns-tz';
import { getCityInfo } from './cityData';

// 실제 비행 스케줄인지 확인하는 함수 (Flight 또는 FlightSchedule 타입 지원)
export const isActualFlight = (flight: any): boolean => {
  // FIXED SKD, STANDBY, DAY OFF, G/S STUDENT, RESERVE, OTHRDUTY 등은 실제 비행이 아님
  const specialSchedules = [
    'FIXED SKD',
    'STANDBY',
    'DAY OFF',
    'A STBY',
    'B STBY',
    'G/S STUDENT',
    'GS STUDENT',
    'G/S',
    'GS',
    'GROUND SCHOOL',
    'R_SIM1',
    'R_SIM2',
    'RESERVE',
    'OTHRDUTY',
    'RDO',
    'ALV',
    'ALM',
    'ANNUAL LEAVE',
    'VAC_R',
    'VAC',
    'SIM',
    'MEDICAL CHK',
    'MEDICAL',
    '안전회의',
    'SAFETY',
    'TRAINING',
    '교육',
    'BRIEFING',
    '브리핑',
    'MEETING',
    '회의',
    'CHECK',
    '점검',
    'INSPECTION',
    '검사'
  ];

  // FlightSchedule 타입인 경우 airlineFlightNumber 사용, Flight 타입인 경우 flightNumber 사용
  const flightNumber = flight.airlineFlightNumber || flight.flightNumber;

  // 비행편 번호가 특별 스케줄에 포함되거나 비어있으면 실제 비행이 아님
  if (!flightNumber || specialSchedules.some(special =>
    flightNumber.toUpperCase().includes(special.toUpperCase()) ||
    flightNumber.toUpperCase() === special.toUpperCase()
  )) {
    return false;
  }

  // 항공편 번호 형식은 엄격히 제한하지 않음 (예: 101, KE101 모두 허용)

  // route 정보가 없거나 비어있으면 실제 비행이 아님
  if (!flight.route || flight.route.trim() === '') {
    return false;
  }

  return true;
};

// 공통: route 문자열(ICN/NRT)을 안전하게 파싱
export const parseRoute = (route: string | undefined | null): { departure: string; arrival?: string } => {
  if (!route || typeof route !== 'string') return { departure: '' };
  const parts = route
    .split('/')
    .map(s => (s || '').trim().toUpperCase())
    .filter(Boolean);
  const departure = parts[0] || '';
  const arrival = parts[1];
  return { departure, arrival };
};

// 카드 표시에 사용할 공항 코드 결정 로직(재사용 가능)
export const getAirportCodeForCard = (
  route: string | undefined,
  type: 'last' | 'next' | 'nextNext',
  baseIata?: string
): string => {
  const { departure, arrival } = parseRoute(route);
  const base = (baseIata || '').toUpperCase();

  // 베이스 공항이 설정되어 있으면 베이스 공항이 아닌 방향의 도시를 우선 표시
  if (base && (departure || arrival)) {
    if (departure === base && arrival) return arrival;
    if (arrival === base && departure) return departure;
  }

  // 베이스 공항이 없거나 베이스 공항과 다른 경우
  if (type === 'next' || type === 'nextNext') {
    // 다음 비행 카드는 도착지 우선 표시 (목적지가 더 중요)
    return arrival || departure || '';
  } else {
    // 최근 비행 카드는 도착지 우선, 없으면 출발지
    return arrival || departure || '';
  }
};

export const calculateDday = (flightDateStr: string, todayStr: string, std?: string): DDayInfo => {
  try {
    // UTC로 저장된 데이터를 현지 시간으로 변환
    const flightDateUtc = new Date(`${flightDateStr}T00:00:00Z`);
    const todayUtc = new Date(`${todayStr}T00:00:00Z`);

    // 현지 시간으로 날짜 변환 (더 안정적인 방법 사용)
    const flightYear = flightDateUtc.getFullYear();
    const flightMonth = flightDateUtc.getMonth();
    const flightDay = flightDateUtc.getDate();

    const todayYear = todayUtc.getFullYear();
    const todayMonth = todayUtc.getMonth();
    const todayDay = todayUtc.getDate();

    // 현지 날짜 기준으로 차이 계산
    const flightDate = new Date(flightYear, flightMonth, flightDay);
    const todayDate = new Date(todayYear, todayMonth, todayDay);
    const diffTime = flightDate.getTime() - todayDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return { text: '오늘', days: 0 };
    }
    if (diffDays === 1) return { text: '내일', days: 1 };
    if (diffDays > 0) return { text: `${diffDays}일 후`, days: diffDays };
    if (diffDays === -1) return { text: '어제', days: -1 };
    return { text: `${Math.abs(diffDays)}일 전`, days: diffDays };
  } catch (error) {
    return { text: '날짜 오류', days: 0 };
  }
};

// 메모이제이션을 위한 캐시
const currencyCache = new Map<string, CurrencyInfo>();

export const calculateCurrency = (flights: Flight[], type: 'takeoff' | 'landing', todayStr: string): CurrencyInfo => {
  try {

    // 기존 캐시 클리어 (자격 계산 로직 수정했으므로)
    if (currencyCache.size > 0) {
      currencyCache.clear();
    }

    // 캐시 키 생성 (6개월 데이터 기준)
    const cacheKey = `${type}-6months-${todayStr}-${flights.length}-${flights.map(f => `${f.date}-${f.status.departed}-${f.status.landed}`).join(',')}`;

    // 캐시에서 확인
    if (currencyCache.has(cacheKey)) {
      return currencyCache.get(cacheKey)!;
    }
    // UTC로 저장된 데이터를 현지 시간으로 변환하여 날짜 계산
    const todayUtc = new Date(`${todayStr}T00:00:00Z`);
    const todayYear = todayUtc.getFullYear();
    const todayMonth = todayUtc.getMonth();
    const todayDay = todayUtc.getDate();
    const today = new Date(todayYear, todayMonth, todayDay);

    const sixMonthsAgo = new Date(todayYear, todayMonth, todayDay);
    sixMonthsAgo.setMonth(today.getMonth() - 6);

    // 최근 6개월 내의 모든 비행 스케줄을 가져옴 (이륙/착륙 버튼 상태와 관계없이)
    const recentFlights = flights
      .filter(f => {
        try {
          const flightDateUtc = new Date(`${f.date}T00:00:00Z`);
          const flightYear = flightDateUtc.getFullYear();
          const flightMonth = flightDateUtc.getMonth();
          const flightDay = flightDateUtc.getDate();
          const flightDate = new Date(flightYear, flightMonth, flightDay);
          return flightDate >= sixMonthsAgo && flightDate <= today;
        } catch (error) {
          return false;
        }
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 자격 계산용: 90일 기준으로 필터링
    const ninetyDaysAgo = new Date(todayYear, todayMonth, todayDay);
    ninetyDaysAgo.setDate(today.getDate() - 90);


    const currencyFlights = flights
      .filter(f => {
        try {
          const flightDateUtc = new Date(`${f.date}T00:00:00Z`);
          const flightYear = flightDateUtc.getFullYear();
          const flightMonth = flightDateUtc.getMonth();
          const flightDay = flightDateUtc.getDate();
          const flightDate = new Date(flightYear, flightMonth, flightDay);
          return flightDate >= ninetyDaysAgo && flightDate <= today;
        } catch (error) {
          return false;
        }
      });


    // 실제로 이륙/착륙 버튼을 누른 비행들 (자격 계산용 - 90일 기준)
    const actualEvents = currencyFlights
      .filter(f => type === 'takeoff' ? f.status.departed : f.status.landed);


    // 6개월 데이터에서 이륙/착륙 버튼을 누른 비행들 (그래프용)
    const graphEvents = recentFlights
      .filter(f => type === 'takeoff' ? f.status.departed : f.status.landed);

    // 자격 계산: 90일 기준으로 계산
    const displayCount = actualEvents.length;
    const isCurrent = displayCount >= 3;
    let expiryDate: string | null = null;
    let daysUntilExpiry: number | null = null;

    if (isCurrent && actualEvents.length >= 3) {
      // 날짜순으로 정렬된 이벤트들 (최근 순서대로)
      const sortedEvents = [...actualEvents].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // 최근 3번째 이벤트의 90일 후 날짜를 만료일로 설정
      if (sortedEvents.length >= 3) {
        const thirdEventDate = new Date(sortedEvents[2].date); // 0-based index이므로 2가 3번째 (최근에서)
        const expiryDateFromThird = new Date(thirdEventDate);
        expiryDateFromThird.setDate(thirdEventDate.getDate() + 90);

        // 한국 시간대로 변환하여 날짜 표시
        const koreanDate = new Date(expiryDateFromThird.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        expiryDate = koreanDate.toLocaleDateString('ko-KR');
        daysUntilExpiry = Math.ceil((expiryDateFromThird.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }
    }


    // 결과 생성 (90일 기준 데이터 사용)
    const result = { count: displayCount, isCurrent, expiryDate, daysUntilExpiry, recentEvents: actualEvents };


    // 캐시에 저장 (최대 100개까지만)
    if (currencyCache.size >= 100) {
      const firstKey = currencyCache.keys().next().value;
      currencyCache.delete(firstKey);
    }
    currencyCache.set(cacheKey, result);

    return result;
  } catch (error) {
    return { count: 0, isCurrent: false, expiryDate: null, daysUntilExpiry: null, recentEvents: [] };
  }
};

export const findLastAndNextFlights = (flights: Flight[], todayStr: string): { lastFlight: Flight | undefined, nextFlight: Flight | undefined, nextNextFlight: Flight | undefined } => {
  if (!flights || flights.length === 0) {
    return { lastFlight: undefined, nextFlight: undefined, nextNextFlight: undefined };
  }

  // 이미 상단의 isActualFlight를 사용

  const sortedFlights = [...flights]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const actualFlights = sortedFlights.filter(isActualFlight);

  const pastFlights: Flight[] = [];
  const futureFlights: Flight[] = [];

  // 각 비행편을 출발 시간 기준으로 과거/미래 구분
  actualFlights.forEach(flight => {
    // UTC 출발 시간이 있으면 가장 정확한 기준으로 사용
    if (flight.departureDateTimeUtc) {
      try {
        const departureUtc = new Date(flight.departureDateTimeUtc);
        const nowUtc = new Date(); // 현재 기기 시간 (자동으로 UTC로 변환됨)

        // UTC 시간 기준으로 직접 비교
        if (departureUtc.getTime() <= nowUtc.getTime()) {
          pastFlights.push(flight);
        } else {
          futureFlights.push(flight);
        }
      } catch (error) {
        // UTC 시간 파싱 오류 시 기존 로직으로 fallback
        console.warn('UTC 출발시간 파싱 오류, 기존 로직으로 fallback:', error);
        // 기존 std 기반 로직으로 처리하도록 계속 진행
      }
    }

    // UTC 시간이 없거나 파싱 오류가 발생한 경우 기존 std 기반 로직 사용
    if (!flight.departureDateTimeUtc || (!pastFlights.includes(flight) && !futureFlights.includes(flight))) {
      if (!(flight as any).std || !flight.route) {
        // 출발 시간이나 노선 정보가 없는 경우 현지 시간 기준으로 판단
        const nowUtc = new Date(); // 현재 UTC 시간
        const nowYear = nowUtc.getFullYear();
        const nowMonth = nowUtc.getMonth();
        const nowDay = nowUtc.getDate();
        const now = new Date(nowYear, nowMonth, nowDay);

        const flightDateUtc = new Date(`${flight.date}T00:00:00Z`);
        const flightYear = flightDateUtc.getFullYear();
        const flightMonth = flightDateUtc.getMonth();
        const flightDay = flightDateUtc.getDate();
        const flightDate = new Date(flightYear, flightMonth, flightDay);

        if (flightDate.getTime() < now.getTime()) {
          pastFlights.push(flight);
        } else {
          futureFlights.push(flight);
        }
      } else {
        // 출발지 로컬 시간 기준으로 판단
        try {
          const departureAirport = flight.route?.split('/')[0];
          if (!departureAirport) {
            // route 정보가 없거나 잘못된 경우 현지 시간 기준으로 판단
            const nowUtc = new Date(); // 현재 UTC 시간
            const nowYear = nowUtc.getFullYear();
            const nowMonth = nowUtc.getMonth();
            const nowDay = nowUtc.getDate();
            const now = new Date(nowYear, nowMonth, nowDay);

            const [hours, minutes] = (flight as any).std.split(':').map(Number);
            const flightDateTimeUtc = new Date(`${flight.date}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00Z`);
            const flightYear = flightDateTimeUtc.getFullYear();
            const flightMonth = flightDateTimeUtc.getMonth();
            const flightDay = flightDateTimeUtc.getDate();
            const flightDate = new Date(flightYear, flightMonth, flightDay);

            if (flightDate.getTime() <= now.getTime()) {
              pastFlights.push(flight);
            } else {
              futureFlights.push(flight);
            }
          } else {
            const cityInfo = getCityInfo(departureAirport);

            if (cityInfo) {
              // 출발지 현지 시간으로 출발 시점 계산
              const timeParts = (flight as any).std?.split(':');
              if (!timeParts || timeParts.length !== 2) {
                // std 형식이 잘못된 경우 현지 시간 기준으로 판단
                const nowUtc = new Date(); // 현재 UTC 시간
                const nowLocalDate = nowUtc.toLocaleDateString();
                const now = new Date(nowLocalDate);

                const flightDateUtc = new Date(`${flight.date}T00:00:00Z`);
                const flightLocalDate = flightDateUtc.toLocaleDateString();
                const flightDate = new Date(flightLocalDate);

                if (flightDate.getTime() < now.getTime()) {
                  pastFlights.push(flight);
                } else {
                  futureFlights.push(flight);
                }
              } else {
                const [hours, minutes] = timeParts.map(Number);
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
              }
            } else {
              // 도시 정보가 없는 경우 현지 시간 기준으로 판단
              const nowUtc = new Date(); // 현재 UTC 시간
              const nowLocalDate = nowUtc.toLocaleDateString();
              const now = new Date(nowLocalDate);

              const [hours, minutes] = (flight as any).std.split(':').map(Number);
              const flightDateTimeUtc = new Date(`${flight.date}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00Z`);
              const flightLocalDate = flightDateTimeUtc.toLocaleDateString();
              const flightDate = new Date(flightLocalDate);

              if (flightDate.getTime() <= now.getTime()) {
                pastFlights.push(flight);
              } else {
                futureFlights.push(flight);
              }
            }
          }
        } catch (error) {
          // 오류 발생 시 현지 시간 기준으로 판단
          const nowUtc = new Date(); // 현재 UTC 시간
          const nowLocalDate = nowUtc.toLocaleDateString();
          const now = new Date(nowLocalDate);

          const timeParts = (flight as any).std?.split(':');
          if (timeParts && timeParts.length === 2) {
            const [hours, minutes] = timeParts.map(Number);
            const flightDateTimeUtc = new Date(`${flight.date}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00Z`);
            const flightLocalDate = flightDateTimeUtc.toLocaleDateString();
            const flightDate = new Date(flightLocalDate);

            if (flightDate.getTime() <= now.getTime()) {
              pastFlights.push(flight);
            } else {
              futureFlights.push(flight);
            }
          } else {
            // std 형식이 잘못된 경우 날짜만으로 판단
            const flightDateUtc = new Date(`${flight.date}T00:00:00Z`);
            const flightLocalDate = flightDateUtc.toLocaleDateString();
            const flightDate = new Date(flightLocalDate);

            if (flightDate.getTime() < now.getTime()) {
              pastFlights.push(flight);
            } else {
              futureFlights.push(flight);
            }
          }
        }
      }
    }
  });

  const result = {
    lastFlight: pastFlights.pop(), // 배열의 마지막 항목 (가장 최근 과거 비행 - 출발 시간 기준)
    nextFlight: futureFlights[0],  // 배열의 첫 항목 (가장 가까운 미래 비행 - 출발 시간 기준)
    nextNextFlight: futureFlights[1] // 배열의 두 번째 항목 (그 다음 비행 - 출발 시간 기준)
  };

  // 로그 제거 (프로덕션 클린)

  return result;
};

export const formatTime = (totalMinutes: number): string => {
  if (totalMinutes === 0) return '00:00';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// ✨ 스마트 병합 함수 - 변경된 부분만 업데이트하고 이착륙 상태 보존
export const mergeFlightDataWithStatusPreservation = (
  existingFlights: Flight[],
  newFlights: Flight[],
  options?: { removeMissing?: boolean }
): Flight[] => {

  const mergedFlights: Flight[] = [];
  const processedExistingIds = new Set<number>();

  // 새로운 데이터를 기준으로 처리
  for (const newFlight of newFlights) {
    // 1) 날짜+편명+스케줄타입이 모두 같은 항목 우선 매칭
    let existingFlight = existingFlights.find(existing =>
      existing.date === newFlight.date &&
      existing.flightNumber === newFlight.flightNumber &&
      existing.scheduleType === newFlight.scheduleType
    );
    // 2) 스케줄타입이 변경된 경우: 날짜+편명만 같은 기존 항목을 찾아 교체
    if (!existingFlight) {
      existingFlight = existingFlights.find(existing =>
        existing.date === newFlight.date &&
        existing.flightNumber === newFlight.flightNumber
      );
    }


    if (existingFlight) {
      // ✨ BRIEFING INFO 데이터 병합 (regNo, cabinCrew, crew 업데이트)
      const isBriefingData = newFlight.isBriefingInfo === true || (newFlight.route === '' &&
        (newFlight.regNo || newFlight.cabinCrew?.length > 0 || newFlight.crew?.length > 0));

      if (isBriefingData) {
        // BRIEFING INFO 데이터: regNo, cabinCrew, crew 스마트 업데이트
        let finalRegNo = existingFlight.regNo;
        let finalCabinCrew = existingFlight.cabinCrew;
        let finalCrew = existingFlight.crew;

        // REG NO 업데이트 (BRIEFING INFO에 있고 기존과 다를 경우)
        if (newFlight.regNo && newFlight.regNo !== existingFlight.regNo) {
          finalRegNo = newFlight.regNo;
        }

        // CABIN CREW 업데이트 (BRIEFING INFO에 있고 기존과 다를 경우)
        if (newFlight.cabinCrew && newFlight.cabinCrew.length > 0) {
          const cabinCrewChanged = JSON.stringify(existingFlight.cabinCrew || []) !== JSON.stringify(newFlight.cabinCrew);
          if (cabinCrewChanged) {
            finalCabinCrew = newFlight.cabinCrew;
          }
        }

        // COCKPIT CREW 업데이트 (BRIEFING INFO에 있고 기존과 다를 경우)
        if (newFlight.crew && newFlight.crew.length > 0) {
          finalCrew = newFlight.crew.map(newCrewMember => {
            const existingMember = (existingFlight.crew || []).find(c => c.empl === newCrewMember.empl);
            if (existingMember) {
              // Monthly SKD에서 C1, C2, F1, F2 등으로 상세하게 적혀있고, Briefing에는 C, F로만 적혀있다면 기존 값을 유지
              let mergedPosn = newCrewMember.posn;
              if (
                existingMember.posn && newCrewMember.posn &&
                existingMember.posn.startsWith(newCrewMember.posn) &&
                existingMember.posn.length > newCrewMember.posn.length
              ) {
                mergedPosn = existingMember.posn;
              }
              return { ...newCrewMember, posn: mergedPosn };
            }
            return newCrewMember;
          });
        }

        // 실제 변경사항이 있는지 확인
        const hasRegNoChange = finalRegNo !== existingFlight.regNo;
        const hasCabinCrewChange = JSON.stringify(finalCabinCrew || []) !== JSON.stringify(existingFlight.cabinCrew || []);
        const hasCockpitCrewChange = JSON.stringify(finalCrew || []) !== JSON.stringify(existingFlight.crew || []);
        const hasAnyChange = hasRegNoChange || hasCabinCrewChange || hasCockpitCrewChange;

        const mergedFlight: Flight = {
          ...existingFlight, // 기존 데이터 유지
          // 스마트 병합된 데이터만 업데이트
          regNo: finalRegNo,
          cabinCrew: finalCabinCrew,
          crew: finalCrew,
          // 변경사항이 있을 때만 lastModified와 version 업데이트
          lastModified: hasAnyChange ? new Date().toISOString() : existingFlight.lastModified,
          version: hasAnyChange ? (existingFlight.version || 0) + 1 : existingFlight.version,
        };

        if (hasAnyChange) {
          mergedFlights.push(mergedFlight);
        } else {
          mergedFlights.push(existingFlight); // 변경사항이 없으면 기존 데이터 그대로 사용
        }
        processedExistingIds.add(existingFlight.id);
        continue;
      }

      // ✨ 일반 스케줄 데이터: 변경 감지 및 스마트 업데이트 (스케줄타입 변경도 포함)
      const hasChanges = detectChanges(existingFlight, newFlight);

      // ✨ 기존 이착륙 상태 보존하면서 새로운 정보 업데이트
      const mergedFlight: Flight = {
        ...newFlight, // 새로운 스케줄 정보 (시간, 크루, 노선 등)
        // ✨ 이착륙 상태는 항상 기존 것 보존
        status: existingFlight.status || { departed: false, landed: false },
        // ✨ 변경 사항이 있을 때만 수정 시각/버전 업데이트
        lastModified: hasChanges ? new Date().toISOString() : existingFlight.lastModified,
        version: hasChanges ? (existingFlight.version || 0) + 1 : (existingFlight.version || 0),
        // ✨ 기존 ID 유지 (데이터베이스 연관성)
        id: existingFlight.id
      };

      mergedFlights.push(mergedFlight);
      processedExistingIds.add(existingFlight.id);
    } else {
      // ✨ 기존 스케줄이 없는 경우 처리
      // 브리핑 정보로만 구성된 항목이라면
      // 새로운 스케줄을 생성하지 않고 건너뜀 (요구사항: 업데이트만 수행)
      const isBriefingOnly = newFlight.isBriefingInfo === true || (newFlight.route === '' && (
        (newFlight.regNo && String(newFlight.regNo).trim() !== '') ||
        (Array.isArray(newFlight.cabinCrew) && newFlight.cabinCrew.length > 0) ||
        (Array.isArray(newFlight.crew) && newFlight.crew.length > 0)
      ));

      if (isBriefingOnly) {
        // skip: 존재하는 스케줄에만 적용
        continue;
      }

      // 일반 스케줄은 새로 추가
      mergedFlights.push({
        ...newFlight,
        status: newFlight.status || { departed: false, landed: false },
        lastModified: new Date().toISOString(),
        version: 0
      });
    }
  }

  // ✨ 누락 스케줄 처리: 기본은 삭제(유지하지 않음). 옵션으로 유지 가능
  const shouldKeepMissing = options?.removeMissing === false;
  if (shouldKeepMissing) {
    for (const existingFlight of existingFlights) {
      if (!processedExistingIds.has(existingFlight.id)) {
        mergedFlights.push(existingFlight);
      }
    }
  }


  return mergedFlights;
};

// ✨ 변경 감지 함수
const detectChanges = (existing: Flight, newFlight: Flight): boolean => {
  const normalizeScalar = (v: any) => {
    if (v === undefined || v === null) return '';
    return v;
  };
  const normalizeArray = (arr: any) => {
    if (!arr) return [] as any[];
    return Array.isArray(arr) ? arr : [];
  };

  // 비교할 필드들 (UTC 시간 필드, regNo 포함)
  const fieldsToCompare: (keyof Flight)[] = [
    'route', 'std', 'sta', 'block', 'scheduleType', 'monthlyTotalBlock',
    'departureDateTimeUtc', 'arrivalDateTimeUtc', 'showUpDateTimeUtc', 'acType',
    'regNo'
  ];

  // 크루 비교: undefined/null/[] 동일 취급, 순서까지 동일해야 변경으로 간주
  const existingCrew = normalizeArray(existing.crew);
  const newCrew = normalizeArray(newFlight.crew);
  const crewChanged = JSON.stringify(existingCrew) !== JSON.stringify(newCrew);

  // 객실 승무원 비교: undefined/null/[] 동일 취급
  const existingCabinCrew = normalizeArray(existing.cabinCrew);
  const newCabinCrew = normalizeArray(newFlight.cabinCrew);
  const cabinCrewChanged = JSON.stringify(existingCabinCrew) !== JSON.stringify(newCabinCrew);

  // 다른 필드 비교: undefined/null/'' 동일 취급
  const otherFieldsChanged = fieldsToCompare.some((field) => {
    const existingValue = normalizeScalar(existing[field]);
    const newValue = normalizeScalar(newFlight[field]);
    return existingValue !== newValue;
  });

  return crewChanged || cabinCrewChanged || otherFieldsChanged;
};

// ✨ 변경 상세 정보 반환 함수
const getChangeDetails = (existing: Flight, newFlight: Flight): string[] => {
  const changes: string[] = [];

  if (existing.route !== newFlight.route) {
    changes.push(`노선: ${existing.route} → ${newFlight.route}`);
  }
  if ((existing as any).std !== (newFlight as any).std) {
    changes.push(`출발시간: ${(existing as any).std} → ${(newFlight as any).std}`);
  }
  if ((existing as any).sta !== (newFlight as any).sta) {
    changes.push(`도착시간: ${(existing as any).sta} → ${(newFlight as any).sta}`);
  }
  if (existing.scheduleType !== newFlight.scheduleType) {
    changes.push(`스케줄타입: ${existing.scheduleType} → ${newFlight.scheduleType}`);
  }
  if (JSON.stringify(existing.crew) !== JSON.stringify(newFlight.crew)) {
    changes.push(`크루 변경`);
  }
  if (existing.monthlyTotalBlock !== newFlight.monthlyTotalBlock) {
    changes.push(`월별총시간: ${existing.monthlyTotalBlock} → ${newFlight.monthlyTotalBlock}`);
  }
  if (existing.acType !== newFlight.acType) {
    changes.push(`A/C TYPE: ${existing.acType} → ${newFlight.acType}`);
  }
  if (existing.departureDateTimeUtc !== newFlight.departureDateTimeUtc) {
    changes.push(`출발UTC시간 변경`);
  }
  if (existing.arrivalDateTimeUtc !== newFlight.arrivalDateTimeUtc) {
    changes.push(`도착UTC시간 변경`);
  }
  if (existing.showUpDateTimeUtc !== newFlight.showUpDateTimeUtc) {
    changes.push(`SHOW UP시간 변경`);
  }

  return changes;
};

// ✨ 월별 데이터 완전 덮어쓰기 함수 (업로드된 파일 기준으로 교체)
export const replaceMonthDataWithStatusPreservation = async (
  newFlights: Flight[],
  userId: string,
  targetYear: number,
  targetMonth: number
): Promise<void> => {
  try {
    // 이 함수는 호출 시점에 이미 스마트 병합(상태 보존, 변경 감지)이 반영된 newFlights를 받는다.
    // 따라서 여기서는 월 데이터를 비우고 전달된 newFlights를 그대로 저장만 한다.

    // 1) 해당 월 데이터 삭제
    const { remove } = await import('firebase/database');
    const { ref } = await import('firebase/database');
    const { database } = await import('../src/firebase/config');
    const monthPath = `users/${userId}/flights/${targetYear}/${targetMonth}`;
    const monthRef = ref(database, monthPath);
    await remove(monthRef);

    // 2) 전달된 병합 결과 그대로 저장 (lastModified/version/status/id 유지)
    const { addMultipleFlights } = await import('../src/firebase/database');
    await addMultipleFlights(newFlights, userId);
  } catch (error) {
    throw error;
  }
};

// ✨ 완전 덮어쓰기 함수 (업로드된 파일이 최종 기준)
export const completeOverwriteWithUploadedFile = async (
  newFlights: Flight[],
  userId: string,
  targetYear: number,
  targetMonth: number
): Promise<{
  success: boolean;
  message: string;
  stats: {
    totalUploaded: number;
    preserved: number;
    added: number;
    removed: number;
  };
}> => {
  try {

    // 1. 기존 데이터 백업 (이착륙 상태만)
    const { getFlightsByMonth } = await import('../src/firebase/database');
    const existingFlights = await getFlightsByMonth(targetYear, targetMonth, userId);

    if (existingFlights.length > 0) {
    }

    // 2. 업로드된 파일을 기준으로 완전 교체
    const finalFlights: Flight[] = [];
    let preservedCount = 0;
    let addedCount = 0;

    for (const newFlight of newFlights) {

      // 기존 데이터에서 같은 스케줄 찾기 (날짜 + 편명 + 스케줄타입)
      const existingFlight = existingFlights.find(existing => {
        const isMatch = existing.date === newFlight.date &&
          existing.flightNumber === newFlight.flightNumber &&
          existing.scheduleType === newFlight.scheduleType;


        return isMatch;
      });

      if (existingFlight) {

        // 변경사항 감지
        const hasChanges = detectChanges(existingFlight, newFlight);

        if (hasChanges) {
          // 변경사항이 있으면 기존 스케줄 업데이트
          const finalFlight = {
            ...newFlight, // 업로드된 파일의 모든 정보 (CREW, 시간 등 포함)
            status: existingFlight.status || { departed: false, landed: false },
            lastModified: new Date().toISOString(),
            version: (existingFlight.version || 0) + 1,
            id: existingFlight.id // 기존 ID 유지
          };


          finalFlights.push(finalFlight);
          preservedCount++;
        } else {
          // 변경사항이 없으면 기존 스케줄 그대로 유지
          finalFlights.push(existingFlight);
          preservedCount++;
        }
      } else {
        // 완전히 새로운 스케줄

        // 기존 데이터에서 비슷한 스케줄이 있는지 확인 (디버깅용)
        const similarFlight = existingFlights.find(existing =>
          existing.date === newFlight.date && existing.flightNumber === newFlight.flightNumber
        );


        const newFlightData = {
          ...newFlight,
          status: { departed: false, landed: false },
          lastModified: new Date().toISOString(),
          version: 0
        };


        finalFlights.push(newFlightData);
        addedCount++;
      }
    }

    // 3. 기존 데이터 완전 삭제
    const { remove } = await import('firebase/database');
    const { ref } = await import('firebase/database');
    const { database } = await import('../src/firebase/config');
    const monthPath = `users/${userId}/flights/${targetYear}/${targetMonth}`;
    const monthRef = ref(database, monthPath);
    await remove(monthRef);

    // 4. 업로드된 파일 데이터로 완전 교체
    const { addMultipleFlights } = await import('../src/firebase/database');
    await addMultipleFlights(finalFlights, userId);

    const removedCount = existingFlights.length - preservedCount;
    const stats = {
      totalUploaded: newFlights.length,
      preserved: preservedCount,
      added: addedCount,
      removed: removedCount
    };

    const message = `✅ ${targetYear}년 ${targetMonth}월 데이터가 업로드된 파일 기준으로 완전히 교체되었습니다.\n` +
      `📊 결과: 보존 ${preservedCount}개, 추가 ${addedCount}개, 제거 ${removedCount}개 (이착륙 상태 보존)`;


    return {
      success: true,
      message,
      stats
    };

  } catch (error) {
    return {
      success: false,
      message: `❌ 덮어쓰기 실패: ${error}`,
      stats: { totalUploaded: 0, preserved: 0, added: 0, removed: 0 }
    };
  }
};
