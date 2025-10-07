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

    const API_KEY = process.env.CHECKWX_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
    }

    // METAR와 TAF 정보를 병렬로 가져오기
    const [metarResponse, tafResponse] = await Promise.allSettled([
      fetch(`https://api.checkwx.com/metar/${icao}/decoded`, {
        headers: { 'X-API-Key': API_KEY }
      }),
      fetch(`https://api.checkwx.com/taf/${icao}/decoded`, {
        headers: { 'X-API-Key': API_KEY }
      })
    ]);

    let metarData = null;
    let tafData = null;

    // METAR 데이터 처리
    if (metarResponse.status === 'fulfilled' && metarResponse.value.ok) {
      const metarResult = await metarResponse.value.json();
      if (metarResult.data && metarResult.data.length > 0) {
        metarData = metarResult.data[0];
      }
    }

    // TAF 데이터 처리
    if (tafResponse.status === 'fulfilled' && tafResponse.value.ok) {
      const tafResult = await tafResponse.value.json();
      if (tafResult.data && tafResult.data.length > 0) {
        tafData = tafResult.data[0];
      }
    }

    return res.status(200).json({
      metar: metarData,
      taf: tafData,
      icao: icao
    });

  } catch (error: any) {
    console.error('METAR/TAF API 오류:', error);
    return res.status(500).json({ 
      error: error.message || 'METAR/TAF 정보를 가져오는 중 오류가 발생했습니다.' 
    });
  }
}
