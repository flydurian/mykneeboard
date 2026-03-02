import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS 헤더 설정 (로컬 개발과 배포 환경 모두 허용)
  const allowedOrigins = [
    'https://flightdashboard1.vercel.app',
    'https://www.mykneeboard.com',
    'https://mykneeboard.com',
    'https://mykneeboard.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
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
    const { type } = req.query;

    // 차트 데이터 요청인 경우
    if (type === 'chart') {
      return handleChartRequest(req, res);
    }

    // 기본: 환율 조회
    return handleRateRequest(req, res);

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

// 환율 조회 핸들러
async function handleRateRequest(req: VercelRequest, res: VercelResponse) {
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
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('ExchangeRate-API 오류:', errorData);
    throw new Error(errorData['error-type'] || `환율 API 응답 오류: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.result === 'success' && data.conversion_rate) {
    let displayRate = data.conversion_rate;
    let displayUnit = 1;
    const targetCur = data.target_code || toCurrency;

    // VND는 10,000 단위로 표시
    if (data.base_code === 'VND') {
      displayRate *= 10000;
      displayUnit = 10000;
    }

    // toCurrency에 따라 적절한 포맷 적용
    let exchangeRateText: string;
    if (targetCur === 'KRW') {
      exchangeRateText = `${displayUnit.toLocaleString()} ${data.base_code} ≈ ${Math.round(displayRate).toLocaleString('ko-KR')} KRW`;
    } else {
      exchangeRateText = `${displayUnit.toLocaleString()} ${data.base_code} ≈ ${displayRate.toFixed(4)} ${targetCur}`;
    }

    return res.status(200).json({
      success: true,
      conversion_rate: data.conversion_rate,
      fromCurrency: data.base_code,
      toCurrency: targetCur,
      exchangeRateText
    });
  } else {
    throw new Error(data['error-type'] || `환율 API 오류: ${JSON.stringify(data)}`);
  }
}

// 환율 차트 데이터 핸들러
async function handleChartRequest(req: VercelRequest, res: VercelResponse) {
  const { currency = 'JPY' } = req.query;
  const targetCurrency = typeof currency === 'string' ? currency.toUpperCase() : 'JPY';

  // 1개월 전 날짜 계산
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 1);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  // Frankfurter API (무료, API 키 불필요)를 사용하여 1개월 time-series 데이터 가져오기
  const apiUrl = `https://api.frankfurter.app/${startStr}..${endStr}?from=${targetCurrency}&to=KRW`;

  const response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'MyKneeBoard/1.0'
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`Frankfurter API 에러 - 상태코드: ${response.status}`);
  }

  const data = await response.json();

  if (!data.rates || Object.keys(data.rates).length === 0) {
    throw new Error('차트 데이터를 가져올 수 없습니다.');
  }

  const chartData = Object.entries(data.rates)
    .map(([dateStr, rates]: [string, any]) => {
      const date = new Date(dateStr);
      const rate = rates.KRW;
      if (rate === undefined || rate === null) return null;
      return {
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        fullDate: dateStr,
        rate: Number(rate.toFixed(2))
      };
    })
    .filter((item: any) => item !== null)
    .sort((a: any, b: any) => a.fullDate.localeCompare(b.fullDate));

  return res.status(200).json({
    success: true,
    data: chartData,
    currency: targetCurrency,
    baseCurrency: 'KRW'
  });
}
