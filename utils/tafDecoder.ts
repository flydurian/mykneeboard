/**
 * TAF (Terminal Aerodrome Forecast) 디코더
 * ICAO Annex 3 기준에 따른 TAF 문구 파싱
 */

export interface TafDecodedInfo {
    // 기본 정보
    station?: string;
    issueTime?: string;
    validFrom?: string;
    validTo?: string;
    amd?: boolean; // Amendment
    
    // 예보 정보
    forecasts: TafForecast[];
    
    // 원본 텍스트
    rawText: string;
}

export interface TafForecast {
    // 시간 정보
    from?: string;
    to?: string;
    tempo?: boolean;
    prob?: number; // Probability (30, 40, 50, 60, 70, 80, 90)
    
    // 기상 정보
    wind?: string;
    visibility?: string;
    weather?: string[];
    clouds?: string;
    temperature?: string;
    dewpoint?: string;
    
    // 기타 정보
    remarks?: string[];
}

/**
 * TAF 헤더 정보 파싱
 */
function parseTafHeader(text: string): {
    station?: string;
    issueTime?: string;
    validFrom?: string;
    validTo?: string;
    amd?: boolean;
} {
    // TAF KLAX 151200Z 1512/1612 28015G25KT 10SM FEW250
    const headerMatch = text.match(/TAF\s+([A-Z]{4})\s+(\d{6})Z\s+(\d{4})\/(\d{4})(?:\s+AMD)?/i);
    
    if (!headerMatch) return {};
    
    const amd = /\bAMD\b/i.test(text);
    
    return {
        station: headerMatch[1],
        issueTime: headerMatch[2],
        validFrom: headerMatch[3],
        validTo: headerMatch[4],
        amd
    };
}

/**
 * 바람 정보 파싱
 */
function parseWind(text: string): string | null {
    // 28015G25KT, VRB05KT, 00000KT
    const windMatch = text.match(/\b(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?KT\b/);
    if (!windMatch) return null;
    
    const dir = windMatch[1];
    const spd = windMatch[2];
    const gust = windMatch[3];
    
    if (dir === 'VRB') {
        return `Variable at ${spd} knots${gust ? ` gusting to ${gust} knots` : ''}`;
    } else if (dir === '000' && spd === '00') {
        return 'Calm';
    } else {
        return `${dir} degrees at ${spd} knots${gust ? ` gusting to ${gust} knots` : ''}`;
    }
}

/**
 * 가시거리 정보 파싱
 */
function parseVisibility(text: string): string | null {
    // 10SM, P6SM, 1/2SM, 1 1/2SM
    const visMatch = text.match(/\b(P6|\d+(?:\s+\d+\/\d+)?|\d+\/\d+)SM\b/);
    if (!visMatch) return null;
    
    const vis = visMatch[1];
    if (vis === 'P6') {
        return 'Greater than 6 statute miles';
    } else if (vis.includes('/')) {
        return `${vis} statute miles`;
    } else {
        return `${vis} statute miles`;
    }
}

/**
 * 기상 현상 파싱
 */
function parseWeather(text: string): string[] {
    const weather: string[] = [];
    
    // 강수 현상
    const precipPatterns = [
        { pattern: /\bDZ\b/g, text: 'Drizzle' },
        { pattern: /\bRA\b/g, text: 'Rain' },
        { pattern: /\bSN\b/g, text: 'Snow' },
        { pattern: /\bSG\b/g, text: 'Snow grains' },
        { pattern: /\bIC\b/g, text: 'Ice crystals' },
        { pattern: /\bPL\b/g, text: 'Ice pellets' },
        { pattern: /\bGR\b/g, text: 'Hail' },
        { pattern: /\bGS\b/g, text: 'Small hail' },
        { pattern: /\bUP\b/g, text: 'Unknown precipitation' }
    ];
    
    // 강도 수식어
    const intensityModifiers = [
        { pattern: /\b-\b/g, text: 'Light' },
        { pattern: /\b\+\b/g, text: 'Heavy' },
        { pattern: /\bRE\b/g, text: 'Recent' },
        { pattern: /\bSH\b/g, text: 'Shower' },
        { pattern: /\bTS\b/g, text: 'Thunderstorm' },
        { pattern: /\bFZ\b/g, text: 'Freezing' },
        { pattern: /\bMI\b/g, text: 'Shallow' },
        { pattern: /\bPR\b/g, text: 'Partial' },
        { pattern: /\bBC\b/g, text: 'Patches' },
        { pattern: /\bDR\b/g, text: 'Drifting' },
        { pattern: /\bBL\b/g, text: 'Blowing' }
    ];
    
    // 안개 현상
    const fogPatterns = [
        { pattern: /\bFG\b/g, text: 'Fog' },
        { pattern: /\bBR\b/g, text: 'Mist' },
        { pattern: /\bHZ\b/g, text: 'Haze' },
        { pattern: /\bFU\b/g, text: 'Smoke' },
        { pattern: /\bDU\b/g, text: 'Dust' },
        { pattern: /\bSA\b/g, text: 'Sand' },
        { pattern: /\bVA\b/g, text: 'Volcanic ash' }
    ];
    
    // 모든 패턴 검사
    [...precipPatterns, ...intensityModifiers, ...fogPatterns].forEach(({ pattern, text: weatherText }) => {
        if (pattern.test(text)) {
            weather.push(weatherText);
        }
    });
    
    return weather;
}

/**
 * 구름 정보 파싱
 */
function parseClouds(text: string): string | null {
    const cloudMatches = [...text.matchAll(/\b(FEW|SCT|BKN|OVC|SKC|CLR|NSC)(\d{3})?\b/gi)];
    if (cloudMatches.length === 0) return null;
    
    return cloudMatches.map(match => {
        const amount = match[1].toUpperCase();
        const height = match[2];
        
        if (amount === 'SKC' || amount === 'CLR') {
            return 'Clear skies';
        } else if (amount === 'NSC') {
            return 'No significant clouds';
        } else if (height) {
            const heightFt = parseInt(height, 10) * 100;
            const amountText = amount === 'FEW' ? 'Few' :
                              amount === 'SCT' ? 'Scattered' :
                              amount === 'BKN' ? 'Broken' :
                              amount === 'OVC' ? 'Overcast' : amount;
            return `${amountText} at ${heightFt.toLocaleString()} feet`;
        } else {
            return amount;
        }
    }).join(', ');
}

/**
 * 온도/이슬점 정보 파싱
 */
function parseTemperature(text: string): { temperature: string | null; dewpoint: string | null } {
    // TX25/1512Z TN15/1603Z
    const tempMatch = text.match(/\bT(X|N)(\d{2})\/(\d{4})Z\b/);
    if (!tempMatch) return { temperature: null, dewpoint: null };
    
    const type = tempMatch[1]; // X = maximum, N = minimum
    const temp = tempMatch[2];
    const time = tempMatch[3];
    
    const tempText = type === 'X' ? 'Maximum' : 'Minimum';
    return {
        temperature: `${tempText} temperature ${temp}°C at ${time}Z`,
        dewpoint: null
    };
}

/**
 * 시간 정보 파싱
 */
function parseTimeInfo(text: string): {
    from?: string;
    to?: string;
    tempo?: boolean;
    prob?: number;
} {
    // 1512/1612, TEMPO 1512/1515, PROB30 1512/1515
    const timeMatch = text.match(/(?:TEMPO|PROB\d{2})?\s*(\d{4})\/(\d{4})/);
    if (!timeMatch) return {};
    
    const tempo = /\bTEMPO\b/i.test(text);
    const probMatch = text.match(/\bPROB(\d{2})\b/);
    const prob = probMatch ? parseInt(probMatch[1], 10) : undefined;
    
    return {
        from: timeMatch[1],
        to: timeMatch[2],
        tempo,
        prob
    };
}

/**
 * 비고 정보 파싱
 */
function parseRemarks(text: string): string[] {
    const remarks: string[] = [];
    
    // WS (Wind shear)
    const wsMatch = text.match(/\bWS\s+(\d{3})\/(\d{2,3})KT\s+(\d{4})\/(\d{4})\b/);
    if (wsMatch) {
        remarks.push(`Wind shear: ${wsMatch[1]} degrees at ${wsMatch[2]} knots from ${wsMatch[3]}Z to ${wsMatch[4]}Z`);
    }
    
    // RMK (Remarks)
    const rmkMatch = text.match(/\bRMK\s+([^$]+)/);
    if (rmkMatch) {
        remarks.push(`Remarks: ${rmkMatch[1].trim()}`);
    }
    
    return remarks;
}

/**
 * TAF 예보 구간 파싱
 */
function parseForecasts(text: string): TafForecast[] {
    const forecasts: TafForecast[] = [];
    
    // 메인 예보와 TEMPO/PROB 구간을 분리
    const sections = text.split(/\b(TEMPO|PROB\d{2})\b/i);
    
    for (let i = 0; i < sections.length; i += 2) {
        const section = sections[i].trim();
        if (!section) continue;
        
        const timeInfo = parseTimeInfo(section);
        const wind = parseWind(section);
        const visibility = parseVisibility(section);
        const weather = parseWeather(section);
        const clouds = parseClouds(section);
        const { temperature, dewpoint } = parseTemperature(section);
        const remarks = parseRemarks(section);
        
        forecasts.push({
            ...timeInfo,
            wind,
            visibility,
            weather,
            clouds,
            temperature,
            dewpoint,
            remarks
        });
    }
    
    return forecasts;
}

/**
 * 메인 TAF 디코딩 함수
 */
export function decodeTaf(tafText: string): TafDecodedInfo {
    const text = (tafText || '').replace(/\n/g, ' ').trim();
    
    const header = parseTafHeader(text);
    const forecasts = parseForecasts(text);
    
    return {
        ...header,
        forecasts,
        rawText: text
    };
}

/**
 * TAF 정보를 사용자 친화적인 텍스트로 포맷팅
 */
export function formatTafInfo(decoded: TafDecodedInfo): string {
    const sections: string[] = [];
    
    // 헤더 정보
    if (decoded.station) {
        sections.push(`TAF for ${decoded.station}`);
    }
    if (decoded.issueTime) {
        sections.push(`Issued: ${decoded.issueTime}Z`);
    }
    if (decoded.validFrom && decoded.validTo) {
        sections.push(`Valid: ${decoded.validFrom}Z to ${decoded.validTo}Z`);
    }
    if (decoded.amd) {
        sections.push('Amendment');
    }
    
    sections.push(''); // 빈 줄
    
    // 예보 정보
    decoded.forecasts.forEach((forecast, index) => {
        const forecastSections: string[] = [];
        
        // 시간 정보
        if (forecast.from && forecast.to) {
            let timeText = `${forecast.from}Z to ${forecast.to}Z`;
            if (forecast.tempo) timeText = `TEMPO ${timeText}`;
            if (forecast.prob) timeText = `PROB${forecast.prob} ${timeText}`;
            forecastSections.push(timeText);
        }
        
        // 기상 정보
        if (forecast.wind) forecastSections.push(`Wind: ${forecast.wind}`);
        if (forecast.visibility) forecastSections.push(`Visibility: ${forecast.visibility}`);
        if (forecast.weather.length > 0) {
            forecastSections.push(`Weather: ${forecast.weather.join(', ')}`);
        }
        if (forecast.clouds) forecastSections.push(`Clouds: ${forecast.clouds}`);
        if (forecast.temperature) forecastSections.push(forecast.temperature);
        if (forecast.dewpoint) forecastSections.push(forecast.dewpoint);
        
        // 비고
        if (forecast.remarks.length > 0) {
            forecastSections.push(...forecast.remarks);
        }
        
        if (forecastSections.length > 0) {
            sections.push(`Forecast ${index + 1}:`);
            sections.push(...forecastSections.map(s => `  ${s}`));
            sections.push(''); // 빈 줄
        }
    });
    
    return sections.join('\n');
}

/**
 * TAF와 METAR의 차이점을 설명하는 함수
 */
export function getTafExplanation(): string {
    return `
TAF (Terminal Aerodrome Forecast) vs METAR:

TAF:
- 24-30시간 예보
- 시간대별 변화 예측
- TEMPO (임시 변화), PROB (확률 예보) 포함
- 항공기 운항 계획에 사용

METAR:
- 현재 관측 정보
- 실시간 기상 상황
- 30분-1시간마다 갱신
- 항공기 운항 중 안전에 사용
    `.trim();
}
