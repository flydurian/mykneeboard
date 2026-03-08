import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

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
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: `This image is EITHER a "Monthly SKD" (flight schedule) OR a "Briefing Info" (crew roster for a specific flight) from an airline. Extract ALL data from the tables and return it as a JSON 2D array.

CRITICAL RULES FOR "Monthly SKD":
1. If the image is a Monthly Schedule (has "Monthly SKD", "Total Block Time", a list of days):
   - Row 0: ["MONTHLY SKD"]
   - Row 1: ["EMPL : XXXXXX", "MONTH : YYYYMM"] - extract actual EMPL and MONTH
   - Row 2: ["Total Block Time : HH:MM"]
   - Row 3: ["DATE", "FLIGHT", "SHOW UP", "SECTOR", "STD", "STA", "", "", "EMPL", "NAME", "RANK", "DUTY", "POSN"]
   - Row 4+: Extracted data matching columns.
   - Format times as HH:MM, SECTOR as ICN/SFO.
   - For crew members on the same flight, each crew should be a separate row with empty flight data.

CRITICAL RULES FOR "Briefing Info":
1. If the image is for a specific flight (has "Briefing Info", "Flight Schedule", "Cockpit Schedule", "Cabin Schedule"):
   - Row 0 MUST BE EXACTLY: ["BRIEFING INFO"]
   - Include section headers exactly on their own rows as they appear in the image, e.g., ["FLIGHT CREW LIST"], ["CABIN CREW LIST"] OR ["COCKPIT SCHEDULE"], ["CABIN SCHEDULE"].
   - Include EVERY column header beneath the section headers exactly as they appear (including No, Pattern, Empno, Name, English, Rank, Gender, GISU, 라인팀, etc.).
   - IMPORTANT: Ensure EVERY data row has the EXACT SAME number of columns as the header row to prevent data shifting. Do not skip or drop columns even if they seem irrelevant.
   - Extract dates (e.g., 2026-03-07), flight numbers (e.g., OZ713), aircraft registration / HLNO (e.g. HL8251), EMPL, NAME, RANK, POSITION accurately.
   - Maintain the grid layout logically so the parser can read it.

GENERAL RULES:
1. Always output a 2D JSON array (an array of string arrays).
2. If a cell has no relevant data, output "".
3. Return ONLY the JSON array, no markdown formatting, no code blocks, just the raw JSON array.
4. BE EXTREMELY ACCURATE with Korean names. Most Korean names are 3 characters long. DO NOT GUESS OR HALLUCINATE. Spell every single character exactly as it appears in the image.
5. BE EXTREMELY ACCURATE with English names (e.g. spelling) and EMPL numbers (e.g. 6-digit integers). Double-check every single character to prevent typos.`
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
