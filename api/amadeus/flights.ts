import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { airlineCode, flightNumber, originalQuery } = request.body;

    if (!airlineCode || !flightNumber) {
      return response.status(400).json({ error: '항공사 코드와 항공편 번호가 필요합니다.' });
    }

    console.log('🔍 Amadeus API 검색 요청:', { airlineCode, flightNumber, originalQuery });

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

    // 1. D+1부터 D+7일까지의 항공편 스케줄 검색
    const operatingDays = [];
    const scheduleResults = [];
    
    for (let i = 1; i <= 7; i++) {
      const targetDate = getDateAfterDays(i);
      const scheduleUrl = `https://test.api.amadeus.com/v2/schedule/flights?carrierCode=${airlineCode}&flightNumber=${flightNumber}&scheduledDepartureDate=${targetDate}`;
      
      console.log(`📅 ${i}일 후 스케줄 API URL:`, scheduleUrl);
      
      const scheduleResponse = await fetch(scheduleUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (scheduleResponse.ok) {
        const scheduleData = await scheduleResponse.json();
        console.log(`📅 ${i}일 후 스케줄 API 응답:`, scheduleData);
        
        if (scheduleData?.data && scheduleData.data.length > 0) {
          operatingDays.push(targetDate);
          scheduleResults.push(...scheduleData.data);
          console.log(`✅ ${targetDate} 운항 정보 추가됨`);
        } else {
          console.log(`❌ ${targetDate} 운항 정보 없음 (count: ${scheduleData?.meta?.count || 0})`);
        }
      } else {
        console.log(`❌ ${targetDate} API 오류: ${scheduleResponse.status}`);
      }
      
      // Rate Limit 방지를 위해 0.5초 대기 (마지막 날짜 제외)
      if (i < 7) {
        console.log(`⏳ Rate Limit 방지를 위해 0.5초 대기...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log('📅 총 운항일자:', operatingDays);
    console.log('📅 스케줄 결과:', scheduleResults);
    
          // 첫 번째 운항일의 스케줄 데이터 사용
      const scheduleData = scheduleResults.length > 0 ? { data: [scheduleResults[0]] } : null;

    // 2. 항공편 검색 API로 추가 정보 가져오기
    let flightOffersData = null;
    if (scheduleData?.data?.[0]) {
      const origin = scheduleData.data[0].originLocationCode;
      const destination = scheduleData.data[0].destinationLocationCode;
      
      if (origin && destination) {
        const offersUrl = `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&airlineCode=${airlineCode}&max=50`;
        
        console.log('✈️ 항공편 검색 API URL:', offersUrl);
        
        const offersResponse = await fetch(offersUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (offersResponse.ok) {
          flightOffersData = await offersResponse.json();
          console.log('✈️ 항공편 검색 API 응답:', flightOffersData);
        }
      }
    }

    // 3. 결과 데이터 구성
    const results = [];
    
    if (scheduleResults && scheduleResults.length > 0) {
      // 첫 번째 스케줄 결과를 기준으로 사용
      const flight = scheduleResults[0];
      
      console.log('📊 Amadeus 응답 상세 구조:', JSON.stringify(flight, null, 2));
      
      // OZ112 디버깅을 위한 추가 로그
      console.log('🔍 flightPoints 구조:', JSON.stringify(flight.flightPoints, null, 2));
      console.log('🔍 legs 구조:', JSON.stringify(flight.legs, null, 2));
      
      // flightPoints에서 출발지와 도착지 추출 (departure/arrival 속성 기준)
      const origin = flight.flightPoints?.find(p => p.departure)?.iataCode || '';
      const destination = flight.flightPoints?.find(p => p.arrival)?.iataCode || '';
      
      // flightPoints에서 시간 정보 추출 (실제 응답 구조에 맞춤)
      let departureTime = '';
      let arrivalTime = '';
      let aircraftCode = '';
      
      // 출발 시간: flightPoints[0].departure.timings[0].value
      if (flight.flightPoints?.[0]?.departure?.timings?.[0]?.value) {
        departureTime = flight.flightPoints[0].departure.timings[0].value;
      }
      
      // 도착 시간: flightPoints[1].arrival.timings[0].value
      if (flight.flightPoints?.[1]?.arrival?.timings?.[0]?.value) {
        arrivalTime = flight.flightPoints[1].arrival.timings[0].value;
      }
      
      // 기종: Amadeus API의 실제 기종 정보 (추론하지 않음)
      if (flight.legs?.[0]?.aircraftEquipment?.aircraftType) {
        aircraftCode = flight.legs[0].aircraftEquipment.aircraftType;
      } else if (flight.segments?.[0]?.aircraftEquipment?.aircraftType) {
        // segments에서도 기종 정보 확인
        aircraftCode = flight.segments[0].aircraftEquipment.aircraftType;
      } else if (flight.legs?.[0]?.aircraftEquipment?.aircraftTypeCode) {
        // aircraftTypeCode도 확인
        aircraftCode = flight.legs[0].aircraftEquipment.aircraftTypeCode;
      }
      
      // 기종 정보가 없으면 빈 문자열 (추론하지 않음)
      if (!aircraftCode) {
        aircraftCode = '';
      }
      
      console.log('✈️ 파싱된 정보:', {
        departureTime,
        arrivalTime,
        aircraftCode
      });
      
      // 시간 형식 변환 (ISO 문자열에서 시간만 추출)
      const departureTimeStr = departureTime ? departureTime.substring(11, 16) : '';
      const arrivalTimeStr = arrivalTime ? arrivalTime.substring(11, 16) : '';
      const timeStr = departureTimeStr && arrivalTimeStr ? `${departureTimeStr} - ${arrivalTimeStr}` : '';
      
      console.log('🕐 파싱된 시간 정보:', {
        departureTime,
        arrivalTime,
        departureTimeStr,
        arrivalTimeStr,
        timeStr
      });
      
      results.push({
        flightNumber: `${airlineCode}${flightNumber}`,
        airline: airlineCode,
        departure: origin,
        arrival: destination,
        time: timeStr,
        aircraft: aircraftCode,
        status: '정시',
        type: 'Amadeus API',
        duration: flight.duration || '',
        scheduledDeparture: departureTime || '',
        scheduledArrival: arrivalTime || '',
        operatingDays: operatingDays // 운항일자 추가
      });
    }

    // 4. 추가 항공편 정보가 있는 경우 포함
    if (flightOffersData?.data) {
      flightOffersData.data.forEach((offer: any) => {
        const existingFlight = results.find(r => r.flightNumber === `${airlineCode}${flightNumber}`);
        if (!existingFlight) {
          results.push({
            flightNumber: `${airlineCode}${flightNumber}`,
            airline: airlineCode,
            departure: offer.itineraries?.[0]?.segments?.[0]?.departure?.iataCode || '',
            arrival: offer.itineraries?.[0]?.segments?.[0]?.arrival?.iataCode || '',
            time: `${offer.itineraries?.[0]?.segments?.[0]?.departure?.at?.substring(11, 16) || ''} - ${offer.itineraries?.[0]?.segments?.[0]?.arrival?.at?.substring(11, 16) || ''}`,
            aircraft: offer.itineraries?.[0]?.segments?.[0]?.aircraft?.code || '',
            status: '정시',
            type: 'Amadeus API',
            duration: offer.itineraries?.[0]?.duration || ''
          });
        }
      });
    }

    console.log('🎯 최종 검색 결과:', results);
    return response.status(200).json({ results });

  } catch (error) {
    console.error('Amadeus 항공편 검색 오류:', error);
    return response.status(500).json({ 
      error: '항공편 검색에 실패했습니다.' 
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

// 현재 날짜로부터 N일 후의 날짜를 YYYY-MM-DD 형식으로 반환
function getDateAfterDays(days: number): string {
  const today = new Date();
  today.setDate(today.getDate() + days);
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
