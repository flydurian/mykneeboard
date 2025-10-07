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
    const { id } = req.query;
    
    
    if (!id) {
      return res.status(400).json({ error: '도시 ID가 필요합니다.' });
    }

    const API_KEY = process.env.OPENWEATHER_API_KEY;
    
    if (!API_KEY) {
      return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
    }

    // OpenWeatherMap 2.5 Forecast API 호출
    const apiUrl = `http://api.openweathermap.org/data/2.5/forecast?id=${id}&appid=${API_KEY}&units=metric`;
    
    const response = await fetch(apiUrl);

    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenWeatherMap API 오류:', errorData);
      throw new Error(errorData.message || '날씨 정보를 가져올 수 없습니다.');
    }

    const data = await response.json();
    
    // Forecast API 응답을 기존 WeatherData 형식으로 변환
    const currentWeather = data.list[0]; // 첫 번째 예보를 현재 날씨로 사용
    const weatherData = {
      main: {
        temp: currentWeather.main.temp,
        feels_like: currentWeather.main.feels_like,
        temp_min: currentWeather.main.temp_min,
        temp_max: currentWeather.main.temp_max,
        humidity: currentWeather.main.humidity
      },
      weather: [{
        main: currentWeather.weather[0].main,
        description: currentWeather.weather[0].description,
        icon: currentWeather.weather[0].icon
      }],
      wind: {
        speed: currentWeather.wind.speed * 3.6 // m/s to km/h
      },
      sys: {
        sunrise: data.city.sunrise,
        sunset: data.city.sunset
      },
      name: data.city.name,
      // 원본 Forecast API 데이터도 포함
      forecastData: data
    };

    return res.status(200).json(weatherData);

  } catch (error: any) {
    console.error('날씨 API 오류:', error);
    return res.status(500).json({ 
      error: error.message || '날씨 정보를 가져오는 중 오류가 발생했습니다.' 
    });
  }
}
