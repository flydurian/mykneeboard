import type { VercelRequest, VercelResponse } from '@vercel/node';

// Rate limiting: 60 RPM 제한
const requestTimestamps: number[] = [];
const MAX_RPM = 55; // 안전 마진 (60RPM 제한에서 5 여유)

function isRateLimited(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    // 1분 이전 기록 제거
    while (requestTimestamps.length > 0 && requestTimestamps[0] < oneMinuteAgo) {
        requestTimestamps.shift();
    }

    return requestTimestamps.length >= MAX_RPM;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS 헤더 설정
    const allowedOrigins = [
        'https://flightdashboard1.vercel.app',
        'https://www.mykneeboard.com',
        'https://mykneeboard.com',
        'http://localhost:5173',
        'http://localhost:3000'
    ];
    const origin = req.headers.origin || '';
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Rate limit 체크
    if (isRateLimited()) {
        return res.status(429).json({
            error: '요청이 너무 많습니다. 1분 후 다시 시도해주세요.',
            retryAfter: 60
        });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API 키가 설정되지 않았습니다.' });
    }

    try {
        const { imageBase64, mimeType } = req.body;

        if (!imageBase64 || !mimeType) {
            return res.status(400).json({ error: '이미지 데이터가 필요합니다.' });
        }

        // 요청 시간 기록
        requestTimestamps.push(Date.now());

        // Gemini Vision API 호출
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: `This is a flight schedule image (Monthly SKD) from an airline. Extract ALL data from the table and return it as a JSON 2D array.

CRITICAL RULES:
1. The first 4 rows should contain header information:
   - Row 0: ["MONTHLY SKD"] or similar title
   - Row 1: ["EMPL : XXXXXX", "MONTH : YYYYMM"] - extract the actual EMPL number and MONTH value
   - Row 2: ["Total Block Time : HH:MM"] - extract actual block time
   - Row 3: ["DATE", "FLIGHT", "SHOW UP", "SECTOR", "STD", "STA", "", "", "EMPL", "NAME", "RANK", "DUTY", "POSN"] - column headers

2. From row 4 onwards, extract each data row following the column order above.
3. For dates like "06 FRI", output just the date part: "06 FRI"
4. For flight numbers, output just the number: "212"
5. For STANDBY entries like "A350 A-TYPE STANDBY", output as: "A350 A-TYPE STANDBY"
6. For "DAY OFF" entries, output: "DAY OFF"
7. For SHOW UP times like "06 19:15", output as: "06 19:15"
8. For SECTOR like "ICN / SFO", output as: "ICN/SFO" (no spaces around /)
9. For STD/STA times like "06 20:50", output as: "06 20:50"
10. If a cell has no data, output empty string ""
11. For crew members on the same flight, each crew member should be a separate row with the same flight date but empty DATE/FLIGHT/SECTOR/STD/STA fields (they inherit from the flight row above them)
12. Make sure the MONTH value in row 1 is in YYYYMM format (e.g., "202603")

Return ONLY the JSON array, no markdown formatting, no code blocks, just the raw JSON array.`
                            },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: imageBase64
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 8192
                    }
                })
            }
        );

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.text();
            console.error('Gemini API error:', errorData);
            return res.status(500).json({
                error: 'Gemini API 호출 실패',
                details: errorData
            });
        }

        const geminiData = await geminiResponse.json();

        // Gemini 응답에서 텍스트 추출
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
            return res.status(500).json({ error: '이미지에서 데이터를 추출할 수 없습니다.' });
        }

        // JSON 파싱 (코드 블록 제거)
        let cleanedText = responseText.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.slice(7);
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.slice(3);
        }
        if (cleanedText.endsWith('```')) {
            cleanedText = cleanedText.slice(0, -3);
        }
        cleanedText = cleanedText.trim();

        let parsedData: any[][];
        try {
            parsedData = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error('JSON parse error:', cleanedText.substring(0, 500));
            return res.status(500).json({
                error: '이미지 데이터를 파싱할 수 없습니다.',
                rawText: cleanedText.substring(0, 200)
            });
        }

        if (!Array.isArray(parsedData) || parsedData.length === 0) {
            return res.status(500).json({ error: '유효한 스케줄 데이터를 찾을 수 없습니다.' });
        }

        console.log('✅ OCR 성공:', {
            rows: parsedData.length,
            firstRow: parsedData[0],
            secondRow: parsedData[1]
        });

        return res.status(200).json({
            success: true,
            data: parsedData,
            rowCount: parsedData.length
        });

    } catch (error: any) {
        console.error('OCR 처리 오류:', error);
        return res.status(500).json({
            error: '이미지 처리 중 오류가 발생했습니다.',
            details: error.message
        });
    }
}
