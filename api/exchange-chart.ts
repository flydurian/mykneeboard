import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    // CORS 설정
    const allowedOrigins = ['https://mykneeboard.vercel.app', 'http://localhost:5173', 'http://localhost:3000'];
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
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
        // 외화 → KRW 기준
        const apiUrl = `https://api.frankfurter.app/${startStr}..${endStr}?from=${targetCurrency}&to=KRW`;

        const response = await fetch(apiUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'MyKneeBoard/1.0'
            },
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            // Frankfurter 실패 시 대체 API 시도 (ExchangeRate-API 단일 일별 조회 fallback)
            throw new Error(`Frankfurter API 에러 - 상태코드: ${response.status}`);
        }

        const data = await response.json();

        if (!data.rates || Object.keys(data.rates).length === 0) {
            throw new Error('차트 데이터를 가져올 수 없습니다.');
        }

        // rates 형식: { "2026-02-01": { "KRW": 9.24 }, "2026-02-02": { "KRW": 9.30 }, ... }
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

    } catch (error: any) {
        console.error('환율 차트 데이터 로딩 중 오류:', error);
        return res.status(500).json({
            error: '차트 데이터 로딩 실패',
            details: error.message
        });
    }
}
