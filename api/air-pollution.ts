import type { VercelRequest, VercelResponse } from '@vercel/node';

// Rate Limiting 구현
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1분
const RATE_LIMIT_MAX_REQUESTS = 10; // 1분당 최대 10회

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
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS 헤더 설정 (허용된 도메인만)
  const allowedOrigins = [
    'https://mykneeboard.vercel.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'capacitor://localhost'
  ];
  const origin = req.headers.origin as string | undefined;
  // 같은 출처 요청의 경우 Origin 헤더가 없을 수 있으므로 허용
  if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    return res.status(403).json({ error: '허용되지 않은 도메인입니다.' });
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 보안 및 성능 헤더 설정
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // OPTIONS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Rate Limiting 체크
  const clientIP = getRateLimitKey(req);
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({
      error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
      retryAfter: 60
    });
  }

  try {
    const { lat, lon, city } = req.query;
    
    if (!lat || !lon) {
      console.error('🔍 좌표 데이터가 누락되었습니다:', { lat, lon });
      return res.status(400).json({ error: '위도와 경도가 필요합니다.' });
    }
    
    // 좌표 유효성 검증
    const latNum = parseFloat(lat as string);
    const lonNum = parseFloat(lon as string);
    
    if (isNaN(latNum) || isNaN(lonNum)) {
      console.error('🔍 좌표 형식이 올바르지 않습니다:', { lat, lon, latNum, lonNum });
      return res.status(400).json({ error: '위도와 경도는 숫자여야 합니다.' });
    }
    
    if (latNum < -90 || latNum > 90) {
      console.error('🔍 위도 범위가 올바르지 않습니다:', { latNum });
      return res.status(400).json({ error: '위도는 -90과 90 사이여야 합니다.' });
    }
    
    if (lonNum < -180 || lonNum > 180) {
      console.error('🔍 경도 범위가 올바르지 않습니다:', { lonNum });
      return res.status(400).json({ error: '경도는 -180과 180 사이여야 합니다.' });
    }

    const AQICN_API_KEY = process.env.AQICN_API_KEY;
    
    if (!AQICN_API_KEY) {
      console.error('🔍 AQICN API 키가 설정되지 않았습니다.');
      return res.status(500).json({ error: 'AQI API 키가 설정되지 않았습니다.' });
    }

    // AQICN API 호출 - 좌표 기반으로 가장 가까운 측정소 데이터 가져오기
    const apiUrl = `https://api.waqi.info/feed/geo:${latNum};${lonNum}/?token=${AQICN_API_KEY}`;
    
    console.log('🔍 AQICN API 요청 정보:', {
      lat: latNum,
      lon: lonNum,
      city: city || 'unknown'
    });
    
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('🔍 AQICN API 오류:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        lat: latNum,
        lon: lonNum,
        apiKey: AQICN_API_KEY ? '설정됨' : '설정되지 않음'
      });
      throw new Error(errorData.message || '대기질 정보를 가져올 수 없습니다.');
    }

    const data = await response.json();
    
    // 데이터 검증
    if (!data || data.status !== 'ok' || !data.data) {
      console.error('🔍 AQICN API 응답 데이터 구조 오류:', data);
      return res.status(500).json({ error: '대기질 데이터를 찾을 수 없습니다.' });
    }
    
    const airData = data.data;
    if (!airData || typeof airData.aqi !== 'number') {
      console.error('🔍 AQI 데이터 구조 오류:', airData);
      return res.status(500).json({ error: 'AQI 데이터가 올바르지 않습니다.' });
    }
    
    // 디버깅을 위한 로그
    console.log('🔍 AQICN API 응답:', {
      lat: latNum,
      lon: lonNum,
      city: airData.city?.name || city,
      aqi: airData.aqi,
      components: airData.iaqi,
      dataStructure: {
        hasData: !!airData,
        hasAqi: typeof airData.aqi === 'number',
        hasIaqi: !!airData.iaqi,
        hasCity: !!airData.city
      }
    });
    
    // AQI 레벨 계산 (AQICN은 이미 국제규격 0-500 스케일 사용)
    const getAQILevel = (aqi: number) => {
      if (aqi <= 50) return { level: 'Good', color: 'green', description: '좋음', value: aqi };
      if (aqi <= 100) return { level: 'Moderate', color: 'yellow', description: '보통', value: aqi };
      if (aqi <= 150) return { level: 'Unhealthy for Sensitive Groups', color: 'orange', description: '민감군 나쁨', value: aqi };
      if (aqi <= 200) return { level: 'Unhealthy', color: 'red', description: '나쁨', value: aqi };
      if (aqi <= 300) return { level: 'Very Unhealthy', color: 'purple', description: '매우 나쁨', value: aqi };
      if (aqi <= 500) return { level: 'Hazardous', color: 'brown', description: '위험', value: aqi };
      return { level: 'Unknown', color: 'gray', description: '알 수 없음', value: aqi };
    };

    const aqiInfo = getAQILevel(airData.aqi);
    
    // 변환 과정 디버깅 로그
    console.log('🔍 AQI 처리 과정:', {
      originalAQI: airData.aqi,
      aqiInfo,
      isValidAQI: airData.aqi >= 0 && airData.aqi <= 500
    });

    const airPollutionData = {
      aqi: airData.aqi, // AQICN 국제규격 값 (0-500)
      internationalAQI: airData.aqi, // AQICN은 이미 국제규격 사용
      aqiInfo: aqiInfo,
      city: airData.city?.name || city || 'Unknown',
      components: {
        co: airData.iaqi?.co?.v || 0, // 일산화탄소
        no: airData.iaqi?.no?.v || 0, // 일산화질소
        no2: airData.iaqi?.no2?.v || 0, // 이산화질소
        o3: airData.iaqi?.o3?.v || 0, // 오존
        so2: airData.iaqi?.so2?.v || 0, // 이산화황
        pm2_5: airData.iaqi?.pm25?.v || 0, // PM2.5
        pm10: airData.iaqi?.pm10?.v || 0, // PM10
        nh3: airData.iaqi?.nh3?.v || 0 // 암모니아
      },
      dt: airData.time?.iso || new Date().toISOString(), // 측정 시간
      station: airData.city?.name || 'Unknown Station'
    };

    return res.status(200).json(airPollutionData);

  } catch (error: any) {
    console.error('AQI API 오류:', error);
    return res.status(500).json({ 
      error: error.message || '대기질 정보를 가져오는 중 오류가 발생했습니다.' 
    });
  }
}