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
    const { flightNumber, searchType } = request.body;

    // 입력 검증
    if (!flightNumber) {
      return response.status(400).json({ error: '항공편명이 필요합니다.' });
    }

    // 항공편명을 소문자로 변환 (API가 소문자를 요구함)
    const flightId = flightNumber.toLowerCase();
    const searchTypeParam = searchType || 'both'; // 'departure', 'arrival', 'both'

    console.log('🔍 항공편 검색 요청:', {
      flightNumber,
      searchType: searchTypeParam
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
        // 오늘 날짜로 검색하면 자동으로 -3일부터 +6일까지 데이터 제공
        const departureUrl = `https://apis.data.go.kr/B551177/statusOfAllFltDeOdp/getFltDeparturesDeOdp?serviceKey=${encodeURIComponent(API_KEY)}&pageNo=1&numOfRows=50&searchdtCode=s&flightId=${flightId}&type=json`;
        
        
        const departureResponse = await fetch(departureUrl);
        
        if (departureResponse.ok) {
          const departureData = await departureResponse.json();
          
          if (departureData.response?.body?.items) {
            const items = Array.isArray(departureData.response.body.items) 
              ? departureData.response.body.items 
              : [departureData.response.body.items];
            
            items.forEach(item => {
              console.log('📋 출발편 데이터:', {
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
              
              departureResults.push({
                flightNumber: item.flightId || flightNumber.toUpperCase(),
                airline: flightNumber.substring(0, 2).toUpperCase(),
                departure: 'ICN',
                arrival: item.airportCode || '',
                time: '', // 출발/도착 시간 표시하지 않음
                aircraft: item.aircraftSubtype || '',
                status: getStatusText(item.remark || ''),
                type: '인천공항 API (출발)',
                gate: item.gateNumber || '',
                terminal: item.terminalId || '',
                scheduledTime: scheduledTime,
                estimatedTime: item.estimatedDatetime || item.estimatedDateTime || item.estimatedTime || '',
                actualTime: ''
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

    // 도착편 검색
    if (searchTypeParam === 'arrival' || searchTypeParam === 'both') {
      try {
        // 오늘 날짜로 검색하면 자동으로 -3일부터 +6일까지 데이터 제공
        const arrivalUrl = `https://apis.data.go.kr/B551177/statusOfAllFltDeOdp/getFltArrivalsDeOdp?serviceKey=${encodeURIComponent(API_KEY)}&pageNo=1&numOfRows=50&flightId=${flightId}&type=json`;
        
        
        const arrivalResponse = await fetch(arrivalUrl);
        
        if (arrivalResponse.ok) {
          const arrivalData = await arrivalResponse.json();
          
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
                aircraft: item.aircraftSubtype || '',
                status: getStatusText(item.remark || ''),
                type: '인천공항 API (도착)',
                gate: item.gateNumber || '',
                terminal: item.terminalId || '',
                scheduledTime: scheduledTime,
                estimatedTime: item.estimatedDatetime || item.estimatedDateTime || item.estimatedTime || '',
                actualTime: ''
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

    // 결과 합치기 및 기종 정보 통합
    const results = [];
    
    // 출발편 결과 통합
    if (departureResults.length > 0) {
      const uniqueAircraft = [...new Set(departureResults.map(item => item.aircraft).filter(aircraft => aircraft))];
      const firstDeparture = departureResults[0];
      const weeklySchedule = getWeeklyScheduleFromDates(departureResults);
      
      results.push({
        ...firstDeparture,
        aircraft: uniqueAircraft.join(', '), // 모든 기종을 쉼표로 구분하여 표시
        weeklySchedule: weeklySchedule, // 주간 스케줄 정보 추가
        type: '인천공항 API (출발)'
      });
    }
    
    // 도착편 결과 통합
    if (arrivalResults.length > 0) {
      const uniqueAircraft = [...new Set(arrivalResults.map(item => item.aircraft).filter(aircraft => aircraft))];
      const firstArrival = arrivalResults[0];
      const weeklySchedule = getWeeklyScheduleFromDates(arrivalResults);
      
      results.push({
        ...firstArrival,
        aircraft: uniqueAircraft.join(', '), // 모든 기종을 쉼표로 구분하여 표시
        weeklySchedule: weeklySchedule, // 주간 스케줄 정보 추가
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

// 실제 날짜 데이터를 기반으로 주간 스케줄 분석
function getWeeklyScheduleFromDates(flightResults: any[]): string {
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const scheduledDays = new Set<number>();
  
  
  // 오늘 날짜 기준으로 D-3부터 D+6일까지의 요일 계산
  const today = new Date();
  const dates = [];
  
  // D-3부터 D+6일까지의 날짜 생성
  for (let i = -3; i <= 6; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date);
  }
  
  
  // 각 항공편의 날짜를 분석
  flightResults.forEach((flight, index) => {
    console.log(`📅 항공편 ${index + 1} 날짜 분석:`, {
      scheduledTime: flight.scheduledTime,
      estimatedTime: flight.estimatedTime
    });
    
    if (flight.scheduledTime) {
      try {
        let date = null;
        const timeStr = flight.scheduledTime.toString();
        
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
        } else {
          console.log('⚠️ 날짜 파싱 실패:', timeStr);
        }
      } catch (error) {
        console.log('⚠️ 날짜 파싱 오류:', error);
      }
    } else {
      console.log('⚠️ scheduledTime이 없음');
    }
  });
  
  
  if (scheduledDays.size === 0) {
    return '';
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
