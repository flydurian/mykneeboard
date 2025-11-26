import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', 'https://mykneeboard.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { icao } = req.query;
    
    if (!icao) {
      return res.status(400).json({ error: 'ICAO 코드가 필요합니다.' });
    }

    // atis.info API 호출 (리다이렉트 자동 처리)
    const response = await fetch(`https://atis.info/api/${icao}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FlightDashboard/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`DATIS API 응답 오류: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return res.status(200).json(data);

  } catch (error: any) {
    console.error('DATIS API 오류:', error);
    return res.status(500).json({ 
      error: error.message || 'DATIS 정보를 가져오는 중 오류가 발생했습니다.' 
    });
  }
}
