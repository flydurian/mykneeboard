import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { origin, destination, airline, flightNumber } = request.body;

    if (!origin || !destination || !airline || !flightNumber) {
      return response.status(400).json({ error: '출발지, 도착지, 항공사, 항공편 번호가 모두 필요합니다.' });
    }

    // Amadeus API 인증 토큰 가져오기
    const tokenResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/amadeus/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!tokenResponse.ok) {
      throw new Error('Amadeus 인증 토큰을 가져올 수 없습니다.');
    }

    const tokenData = await tokenResponse.json();
    const token = tokenData.access_token;

    // 1. 항공편 검색 API로 기본 정보 가져오기
    const flightSearchUrl = `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&max=10`;
    
    const flightResponse = await fetch(flightSearchUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!flightResponse.ok) {
      throw new Error(`Amadeus 항공편 검색 오류: ${flightResponse.status}`);
    }

    const flightData = await flightResponse.json();
    
    // 2. 항공편 스케줄 API로 상세 정보 가져오기 (간단한 버전)
    const currentDate = getCurrentDate();
    const scheduleUrl = `https://test.api.amadeus.com/v2/schedule/flights?carrierCode=${airline}&flightNumber=${flightNumber}&scheduledDepartureDate=${currentDate}`;
    
    console.log('📅 스케줄 API URL:', scheduleUrl);
    
    const scheduleResponse = await fetch(scheduleUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    let scheduleData = null;
    if (scheduleResponse.ok) {
      scheduleData = await scheduleResponse.json();
      console.log('📅 스케줄 API 응답:', scheduleData);
    } else {
      console.log('❌ 스케줄 API 오류:', scheduleResponse.status, scheduleResponse.statusText);
    }

    // 3. 결과 데이터 구성 (간단한 버전)
    const results = {
      success: true,
      message: '항공편 스케줄 정보를 성공적으로 가져왔습니다.',
      data: {
        origin: origin,
        destination: destination,
        airline: airline,
        flightNumber: flightNumber,
        scheduleData: scheduleData?.data || [],
        operatingDays: []
      }
    };

    return response.status(200).json(results);

  } catch (error) {
    console.error('Amadeus 스케줄 검색 오류:', error);
    console.error('요청 데이터:', request.body);
    return response.status(500).json({ 
      error: '항공편 스케줄 정보를 가져오는데 실패했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  }
}

// 현재 날짜를 YYYY-MM-DD 형식으로 반환
function getCurrentDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


