import type { VercelRequest, VercelResponse } from '@vercel/node';

// Rate Limiting 구현 (강화됨)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1분
const RATE_LIMIT_MAX_REQUESTS = 5; // 1분당 최대 5회 (강화)

function getRateLimitKey(request: VercelRequest): string {
  return request.headers['x-forwarded-for'] as string ||
    request.headers['x-real-ip'] as string ||
    'unknown';
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(key);

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  limit.count++;
  return true;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // CORS 헤더 설정 (허용된 도메인만)
  const allowedOrigins = ['https://mykneeboard.vercel.app', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = request.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    return response.status(403).json({ error: '허용되지 않은 도메인입니다.' });
  }
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS 요청 처리 (preflight)
  if (request.method === 'OPTIONS') {
    return response.status(200).json({});
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  // Rate Limiting 체크
  const clientIP = getRateLimitKey(request);
  if (!checkRateLimit(clientIP)) {
    return response.status(429).json({
      error: 'Too many requests. Please try again later.',
      retryAfter: 60
    });
  }

  try {
    const { flightNumber, searchType, searchTime } = request.body;

    // 입력 검증
    // 시간 기반 검색일 경우 flightNumber가 ALL일 수 있음
    if (!flightNumber) {
      return response.status(400).json({ error: '항공편명이 필요합니다.' });
    }

    // 항공편명을 소문자로 변환 (API가 소문자를 요구함)
    const flightId = flightNumber.toLowerCase();
    const searchTypeParam = searchType || 'both'; // 'departure', 'arrival', 'both'

    // 시간 검색 모드 확인 (HHMM 형식, flightNumber가 ALL인 경우)
    const isTimeSearch = flightNumber === 'ALL' && searchTime && /^\d{4}$/.test(searchTime);

    console.log('🔍 항공편 검색 요청:', {
      flightNumber,
      searchType: searchTypeParam,
      searchTime,
      isTimeSearch
    });

    // 인천공항 API 키
    const API_KEY = process.env.INCHEON_API_KEY;

    if (!API_KEY) {
      console.error('❌ 인천공항 API 키가 설정되지 않음');
      return response.status(500).json({ error: '서버 설정 오류' });
    }

    const departureResults = [];
    const arrivalResults = [];

    // 출발편 검색
    if (searchTypeParam === 'departure' || searchTypeParam === 'both') {
      try {
        // 시간 검색인 경우 검색 시간을 기준으로 조회
        // 인천공항 API는 searchdtCode=s (스케줄 시간 기준), from_time, to_time 파라미터를 지원
        // from_time, to_time은 HHMM 형식
        let departureUrl = '';

        if (isTimeSearch) {
          // 시간 검색: 지정된 시간 기준 앞뒤 1시간 조회
          // 인천공항 API는 searchdtCode=S (스케줄 시간 기준, 대문자 권장), from_time, to_time 파라미터를 지원

          // 한국 시간 기준 오늘 날짜 구하기 (Vercel 서버는 UTC일 수 있음)
          const now = new Date();
          const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
          const kstOffset = 9 * 60 * 60 * 1000;
          const kstDate = new Date(utc + kstOffset);
          const searchDate = kstDate.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

          const searchHour = parseInt(searchTime.substring(0, 2), 10);
          const searchMinute = parseInt(searchTime.substring(2, 4), 10);

          // 시간 계산을 위해 Date 객체 생성 (오늘 날짜 기준)
          const targetTime = new Date(kstDate.getFullYear(), kstDate.getMonth(), kstDate.getDate(), searchHour, searchMinute);

          // 전후 30분 계산
          const fromTimeDate = new Date(targetTime.getTime() - 30 * 60 * 1000);
          const toTimeDate = new Date(targetTime.getTime() + 30 * 60 * 1000);

          const fromTime = `${fromTimeDate.getHours().toString().padStart(2, '0')}${fromTimeDate.getMinutes().toString().padStart(2, '0')}`;
          const toTime = `${toTimeDate.getHours().toString().padStart(2, '0')}${toTimeDate.getMinutes().toString().padStart(2, '0')}`;

          // 자정을 넘어가는 경우 날짜가 달라질 수 있으나, 인천공항 API가 searchDate 하루치만 조회하는 제약이 있을 수 있음.
          // 여기서는 간단히 시간 범위만 계산하여 요청 (API가 00:00~23:59 범위 내에서만 검색될 가능성 있음)
          // 만약 자정을 걸친 검색이 필요하다면 searchDate를 조정해야 할 수도 있음.

          // 시간 검색 시 flightId 파라미터는 제외하고 시간 범위로 조회
          // numOfRows를 늘려 해당 시간대 항공편을 충분히 가져옴 (API가 시간 필터를 무시할 경우를 대비해 최대치로 요청)
          // searchdtCode=S (대문자) 사용 시도 (일부 문서에서 대문자 요구)
          // searchDate 파라미터 추가 (오늘 날짜 명시)
          departureUrl = `https://apis.data.go.kr/B551177/statusOfAllFltDeOdp/getFltDeparturesDeOdp?serviceKey=${encodeURIComponent(API_KEY)}&pageNo=1&numOfRows=4000&searchdtCode=S&searchDate=${searchDate}&from_time=${fromTime}&to_time=${toTime}&type=json`;
        } else {
          // 일반 항공편명 검색
          departureUrl = `https://apis.data.go.kr/B551177/statusOfAllFltDeOdp/getFltDeparturesDeOdp?serviceKey=${encodeURIComponent(API_KEY)}&pageNo=1&numOfRows=50&searchdtCode=s&flightId=${flightId}&type=json`;
        }

        const departureResponse = await fetch(departureUrl);

        if (departureResponse.ok) {
          const departureData = await departureResponse.json();

          // console.log('📥 출발편 API 전체 응답:', JSON.stringify(departureData, null, 2));

          if (departureData.response?.body?.items) {
            const items = Array.isArray(departureData.response.body.items)
              ? departureData.response.body.items
              : [departureData.response.body.items];

            items.forEach(item => {
              // 날짜/시간 정보를 여러 필드에서 시도
              let scheduledTime = item.scheduleDatetime ||
                item.scheduleDateTime ||
                item.scheduledTime ||
                (item.scheduleDate && item.scheduleTime ? `${item.scheduleDate} ${item.scheduleTime}` : '') ||
                item.scheduleDate ||
                '';

              departureResults.push({
                flightNumber: item.flightId || (isTimeSearch ? 'UNKNOWN' : flightNumber.toUpperCase()),
                airline: (item.flightId || '').substring(0, 2).toUpperCase(),
                departure: 'ICN',
                arrival: item.airportCode || '',
                time: '', // 출발/도착 시간 표시하지 않음
                aircraft: item.aircraftSubtype || item.aircraftType || item.aircraftModel || '',
                status: getStatusText(item.remark || ''),
                type: '인천공항 API (출발)',
                gate: item.gateNumber || '',
                terminal: item.terminalId || '',
                scheduledTime: scheduledTime,
                rawScheduleTime: item.scheduleTime, // HHMM 형식 원본 데이터 추가
                estimatedTime: item.estimatedDatetime || item.estimatedDateTime || item.estimatedTime || '',
                actualTime: '',
                // 일주일 스케줄 분석을 위한 추가 데이터
                scheduleDate: item.scheduleDate,
                scheduleTime: item.scheduleTime,
                scheduleDatetime: item.scheduleDatetime || item.scheduleDateTime,
                // 공동운항 정보
                codeshare: item.codeshare || item.codeShare,
                remark: item.remark || '',
                masterFlightId: item.masterFlightId || item.masterFlight
              });
            });
          }
        } else {
          console.log('❌ 출발편 API 응답 실패:', departureResponse.status);
        }
      } catch (error) {
        console.error('❌ 출발편 API 오류:', error);
      }
    }

    // 도착편 검색 (시간 검색 시에는 출발편만 요청하므로 제외할 수도 있으나, 요청에 따라 처리)
    if (!isTimeSearch && (searchTypeParam === 'arrival' || searchTypeParam === 'both')) {
      try {
        // 오늘 날짜로 검색하면 자동으로 -3일부터 +6일까지 데이터 제공
        const arrivalUrl = `https://apis.data.go.kr/B551177/statusOfAllFltDeOdp/getFltArrivalsDeOdp?serviceKey=${encodeURIComponent(API_KEY)}&pageNo=1&numOfRows=50&flightId=${flightId}&type=json`;


        const arrivalResponse = await fetch(arrivalUrl);

        if (arrivalResponse.ok) {
          const arrivalData = await arrivalResponse.json();

          console.log('📥 도착편 API 전체 응답:', JSON.stringify(arrivalData, null, 2));

          if (arrivalData.response?.body?.items) {
            const items = Array.isArray(arrivalData.response.body.items)
              ? arrivalData.response.body.items
              : [arrivalData.response.body.items];

            items.forEach(item => {
              console.log('📋 도착편 데이터:', {
                flightId: item.flightId,
                estimatedDatetime: item.estimatedDatetime,
                scheduleDate: item.scheduleDate,
                scheduleTime: item.scheduleTime,
                scheduledTime: item.scheduledTime,
                scheduleDateTime: item.scheduleDateTime,
                estimatedTime: item.estimatedTime,
                estimatedDateTime: item.estimatedDateTime,
                date: item.date,
                time: item.time,
                departureDate: item.departureDate,
                departureTime: item.departureTime,
                arrivalDate: item.arrivalDate,
                arrivalTime: item.arrivalTime
              });

              // 날짜/시간 정보를 여러 필드에서 시도
              let scheduledTime = item.scheduleDatetime ||
                item.scheduleDateTime ||
                item.scheduledTime ||
                (item.scheduleDate && item.scheduleTime ? `${item.scheduleDate} ${item.scheduleTime}` : '') ||
                item.scheduleDate ||
                '';

              arrivalResults.push({
                flightNumber: item.flightId || flightNumber.toUpperCase(),
                airline: flightNumber.substring(0, 2).toUpperCase(),
                departure: item.airportCode || '',
                arrival: 'ICN',
                time: '', // 출발/도착 시간 표시하지 않음
                aircraft: item.aircraftSubtype || item.aircraftType || item.aircraftModel || '',
                status: getStatusText(item.remark || ''),
                type: '인천공항 API (도착)',
                gate: item.gateNumber || '',
                terminal: item.terminalId || '',
                scheduledTime: scheduledTime,
                estimatedTime: item.estimatedDatetime || item.estimatedDateTime || item.estimatedTime || '',
                actualTime: '',
                // 일주일 스케줄 분석을 위한 추가 데이터
                scheduleDate: item.scheduleDate,
                scheduleTime: item.scheduleTime,
                scheduleDatetime: item.scheduleDatetime || item.scheduleDateTime
              });
            });
          }
        } else {
          console.log('❌ 도착편 API 응답 실패:', arrivalResponse.status);
        }
      } catch (error) {
        console.error('❌ 도착편 API 오류:', error);
      }
    }

    // 결과 합치기 및 기종 정보 통합 (개선됨)
    const results = [];

    // 시간 검색인 경우 개별 항공편을 그대로 반환 (그룹화하지 않음)
    if (isTimeSearch) {
      // 시간순 정렬
      const sortedResults = departureResults.sort((a, b) => {
        const timeA = a.scheduledTime || '';
        const timeB = b.scheduledTime || '';
        return timeA.localeCompare(timeB);
      });

      return response.status(200).json({ results: sortedResults });
    }

    // 출발편 결과 통합
    if (departureResults.length > 0) {
      const uniqueAircraft = [...new Set(departureResults.map(item => item.aircraft).filter(aircraft => aircraft && aircraft.trim()))];
      const firstDeparture = departureResults[0];
      const weeklySchedule = getWeeklyScheduleFromDates(departureResults);

      console.log('📊 출발편 분석 결과:', {
        총개수: departureResults.length,
        기종: uniqueAircraft,
        주간스케줄: weeklySchedule
      });

      results.push({
        ...firstDeparture,
        aircraft: uniqueAircraft.length > 0 ? uniqueAircraft.join(', ') : '기종 정보 없음',
        weeklySchedule: weeklySchedule,
        weeklyData: departureResults, // 일주일 전체 데이터 보존
        type: '인천공항 API (출발)'
      });
    }

    // 도착편 결과 통합
    if (arrivalResults.length > 0) {
      const uniqueAircraft = [...new Set(arrivalResults.map(item => item.aircraft).filter(aircraft => aircraft && aircraft.trim()))];
      const firstArrival = arrivalResults[0];
      const weeklySchedule = getWeeklyScheduleFromDates(arrivalResults);

      console.log('📊 도착편 분석 결과:', {
        총개수: arrivalResults.length,
        기종: uniqueAircraft,
        주간스케줄: weeklySchedule
      });

      results.push({
        ...firstArrival,
        aircraft: uniqueAircraft.length > 0 ? uniqueAircraft.join(', ') : '기종 정보 없음',
        weeklySchedule: weeklySchedule,
        weeklyData: arrivalResults, // 일주일 전체 데이터 보존
        type: '인천공항 API (도착)'
      });
    }

    return response.status(200).json({ results });

  } catch (error) {
    console.error('인천공항 API 항공편 검색 오류:', error);
    return response.status(500).json({
      error: '항공편 검색에 실패했습니다.'
    });
  }
}

// 실제 날짜 데이터를 기반으로 주간 스케줄 분석 (개선됨)
function getWeeklyScheduleFromDates(flightResults: any[]): string {
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const scheduledDays = new Set<number>();

  console.log('📊 주간 스케줄 분석 시작:', flightResults.length, '개 항공편');

  // 각 항공편의 날짜를 분석
  flightResults.forEach((flight, index) => {
    console.log(`📅 항공편 ${index + 1} 날짜 분석:`, {
      scheduledTime: flight.scheduledTime,
      scheduleDate: flight.scheduleDate,
      scheduleTime: flight.scheduleTime,
      scheduleDatetime: flight.scheduleDatetime
    });

    // 여러 필드에서 날짜 정보 시도
    let dateStr = flight.scheduleDate || flight.scheduleDatetime || flight.scheduledTime;

    if (dateStr) {
      let timeStr = dateStr.toString(); // try 블록 밖으로 이동
      try {
        let date = null;

        // 다양한 날짜 형식 시도
        if (timeStr.includes('T') || timeStr.includes('-')) {
          date = new Date(timeStr);
        } else if (/^\d{12}$/.test(timeStr)) {
          // YYYYMMDDHHMM 형식 (인천공항 API 형식)
          const year = timeStr.substring(0, 4);
          const month = timeStr.substring(4, 6);
          const day = timeStr.substring(6, 8);
          date = new Date(`${year}-${month}-${day}`);
        } else if (/^\d{8}$/.test(timeStr)) {
          // YYYYMMDD 형식
          const year = timeStr.substring(0, 4);
          const month = timeStr.substring(4, 6);
          const day = timeStr.substring(6, 8);
          date = new Date(`${year}-${month}-${day}`);
        } else if (/^\d{4}-\d{2}-\d{2}/.test(timeStr)) {
          date = new Date(timeStr);
        } else {
          date = new Date(timeStr);
        }

        if (date && !isNaN(date.getTime())) {
          const dayOfWeek = date.getDay();
          scheduledDays.add(dayOfWeek);
          console.log(`✅ 날짜 파싱 성공: ${timeStr} → ${dayNames[dayOfWeek]}요일`);
        } else {
          console.log('⚠️ 날짜 파싱 실패:', timeStr);
        }
      } catch (error) {
        console.log('⚠️ 날짜 파싱 오류:', error, 'for:', timeStr);
      }
    } else {
      console.log('⚠️ 날짜 정보 없음');
    }
  });

  console.log('📊 분석된 요일:', Array.from(scheduledDays).map(d => dayNames[d]));

  if (scheduledDays.size === 0) {
    return '스케줄 정보 없음';
  }

  const sortedDays = Array.from(scheduledDays).sort();

  if (scheduledDays.size === 7) {
    return '매일 (주 7회)';
  } else if (scheduledDays.size === 1) {
    const dayName = dayNames[sortedDays[0]];
    return `${dayName} (주 1회)`;
  } else {
    const dayNamesList = sortedDays.map(day => dayNames[day]);
    return `${dayNamesList.join(', ')} (주 ${scheduledDays.size}회)`;
  }
}

// 기존 함수 (호환성을 위해 유지)
function getWeeklySchedule(flightResults: any[]): string {
  return getWeeklyScheduleFromDates(flightResults);
}

// 상태 코드를 한국어로 변환
function getStatusText(statusCode: string): string {
  const statusMap: { [key: string]: string } = {
    'ONTIME': '정시',
    'DELAY': '지연',
    'CANCELLED': '취소',
    'BOARDING': '탑승중',
    'DEPARTED': '출발',
    'ARRIVED': '도착',
    'GATE_CLOSED': '탑승마감',
    'FINAL_CALL': '최종안내'
  };

  return statusMap[statusCode] || statusCode || '정시';
}
