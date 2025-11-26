import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS 헤더 설정 (로컬 개발과 배포 환경 모두 허용)
  const allowedOrigins = ['https://mykneeboard.vercel.app', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { fromCurrency, toCurrency = 'KRW' } = req.query;
    
    
    if (!fromCurrency) {
      return res.status(400).json({ error: 'fromCurrency가 필요합니다.' });
    }

    const API_KEY = process.env.EXCHANGE_API_KEY;
    
    if (!API_KEY) {
      console.error('❌ EXCHANGE_API_KEY 환경변수가 설정되지 않았습니다.');
      return res.status(500).json({ error: '환율 API 키가 설정되지 않았습니다.' });
    }

    // ExchangeRate-API 호출
    const apiUrl = `https://v6.exchangerate-api.com/v6/${API_KEY}/pair/${fromCurrency}/${toCurrency}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // 10초 타임아웃 설정
      signal: AbortSignal.timeout(10000)
    });

    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('ExchangeRate-API 오류:', errorData);
      throw new Error(errorData['error-type'] || `환율 API 응답 오류: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.result === 'success' && data.conversion_rate) {
      return res.status(200).json({
        success: true,
        conversion_rate: data.conversion_rate,
        fromCurrency: data.base_code,
        toCurrency: data.target_code,
        exchangeRateText: `1 ${data.base_code} ≈ ${Math.round(data.conversion_rate).toLocaleString('ko-KR')} KRW`
      });
    } else {
      throw new Error(data['error-type'] || `환율 API 오류: ${JSON.stringify(data)}`);
    }

  } catch (error: any) {
    console.error('환율 API 오류:', error);
    
    if (error.name === 'TimeoutError') {
      return res.status(408).json({ error: '환율 정보 로딩 시간 초과' });
    } else if (error.message.includes('Failed to fetch')) {
      return res.status(503).json({ error: '네트워크 연결 실패' });
    } else {
      return res.status(500).json({ 
        error: `환율 정보 로딩 실패: ${error.message}`,
        details: error.message
      });
    }
  }
}
