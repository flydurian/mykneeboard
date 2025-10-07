import type { VercelRequest, VercelResponse } from '@vercel/node';


export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 1. CORS 헤더 설정 (로컬 개발과 배포 환경 모두 허용)
  const allowedOrigins = ['https://mykneeboard.vercel.app', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = (req.headers as any).origin;
  if (origin && allowedOrigins.includes(origin)) {
    (res as any).setHeader('Access-Control-Allow-Origin', origin);
  }
  (res as any).setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  (res as any).setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return (res as any).status(200).end();
  }

  try {
    // 2. 프런트엔드에서 보낸 위도, 경도, 날짜를 가져옵니다.
    const { lat, lng, date } = req.query;
    
    // 3. 위도/경도를 기반으로 시간대 식별 (간단한 경도 기반 추정)
    const longitude = parseFloat(lng as string);
    const latitude = parseFloat(lat as string);
    
    // 경도를 기반으로 대략적인 시간대 추정
    let timezone = 'UTC'; // 기본값
    
    // 경도 기반 시간대 추정 (15도당 1시간)
    const timezoneOffset = Math.round(longitude / 15);
    
    if (timezoneOffset >= 8 && timezoneOffset <= 9) {
      // 동아시아 (한국, 일본, 중국 동부)
      if (latitude > 30) {
        timezone = 'Asia/Seoul'; // 한국
      } else if (latitude > 20) {
        timezone = 'Asia/Tokyo'; // 일본
      } else {
        timezone = 'Asia/Shanghai'; // 중국
      }
    } else if (timezoneOffset >= 7 && timezoneOffset < 8) {
      // 동남아시아
      if (latitude > 10) {
        timezone = 'Asia/Bangkok';
      } else if (latitude > 0) {
        timezone = 'Asia/Singapore';
      } else {
        timezone = 'Asia/Jakarta';
      }
    } else if (timezoneOffset >= 5 && timezoneOffset < 7) {
      // 남아시아, 중동
      if (latitude > 20) {
        timezone = 'Asia/Dubai';
      } else {
        timezone = 'Asia/Kolkata';
      }
    } else if (timezoneOffset >= 0 && timezoneOffset < 2) {
      // 유럽
      if (latitude > 50) {
        timezone = 'Europe/London';
      } else if (latitude > 45) {
        timezone = 'Europe/Paris';
      } else {
        timezone = 'Europe/Rome';
      }
    } else if (timezoneOffset >= -5 && timezoneOffset < 0) {
      // 대서양, 아메리카 동부
      timezone = 'America/New_York';
    } else if (timezoneOffset >= -8 && timezoneOffset < -5) {
      // 아메리카 중부/서부
      timezone = 'America/Los_Angeles';
    }

    // 4. tzid 파라미터를 포함하여 API 호출
    const apiUrl = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${date}&formatted=0&tzid=${encodeURIComponent(timezone)}`;
    const apiResponse = await fetch(apiUrl);

    if (!apiResponse.ok) {
      throw new Error('Sunrise-Sunset API에서 데이터를 가져오는 데 실패했습니다.');
    }

    const data = await apiResponse.json();
    
    // 5. API 응답 로그 출력 (디버깅용)
    
    // 6. API에서 이미 현지 시간으로 받은 데이터를 그대로 사용
    // tzid 파라미터로 인해 sunrise, sunset이 이미 해당 시간대의 현지 시간으로 제공됨
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
