import { worldAirlines, AIRLINE_DATA_LAST_MODIFIED, AirlineInfo } from '../data/worldAirlines';

export type { AirlineInfo };

export interface AirlineDataInfo {
  airlines: AirlineInfo[];
  lastModified: Date;
}

let airlineDataCache: AirlineDataInfo | null = null;

export async function fetchAirlineData(): Promise<AirlineInfo[]> {
  // 로컬 데이터 사용
  if (!airlineDataCache) {
    airlineDataCache = {
      airlines: worldAirlines,
      lastModified: AIRLINE_DATA_LAST_MODIFIED
    };
  }
  
  return airlineDataCache.airlines;
}

export async function fetchAirlineDataWithInfo(): Promise<AirlineDataInfo> {
  const airlines = await fetchAirlineData();
  return airlineDataCache!;
}

export function getCachedAirlineDataInfo(): AirlineDataInfo | null {
  return airlineDataCache;
}



export function searchAirline(query: string, airlines: AirlineInfo[]): AirlineInfo[] {
  const searchTerm = query.trim().toUpperCase();
  
  if (!searchTerm) return [];
  
  // 검색 결과를 점수화하여 정렬
  const scoredResults = airlines.map(airline => {
    let score = 0;
    
    // 정확한 일치 (가장 높은 점수)
    if (airline.iata.toUpperCase() === searchTerm) score += 100;
    if (airline.icao.toUpperCase() === searchTerm) score += 100;
    if (airline.name.toUpperCase() === searchTerm) score += 100;
    if (airline.koreanName === searchTerm) score += 100;
    if (airline.callsign.toUpperCase() === searchTerm) score += 100;
    
    // 시작 부분 일치 (높은 점수)
    if (airline.iata.toUpperCase().startsWith(searchTerm)) score += 50;
    if (airline.icao.toUpperCase().startsWith(searchTerm)) score += 50;
    if (airline.name.toUpperCase().startsWith(searchTerm)) score += 50;
    if (airline.koreanName.startsWith(searchTerm)) score += 50;
    if (airline.callsign.toUpperCase().startsWith(searchTerm)) score += 50;
    
    // 포함 (낮은 점수)
    if (airline.iata.toUpperCase().includes(searchTerm)) score += 10;
    if (airline.icao.toUpperCase().includes(searchTerm)) score += 10;
    if (airline.name.toUpperCase().includes(searchTerm)) score += 10;
    if (airline.koreanName.includes(searchTerm)) score += 10;
    if (airline.callsign.toUpperCase().includes(searchTerm)) score += 10;
    
    return { airline, score };
  }).filter(result => result.score > 0);
  
  // 점수순으로 정렬하고 상위 20개만 반환
  return scoredResults
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(result => result.airline);
}

export function formatDate(date: Date): string {
  const year = date.getFullYear().toString().slice(-2); // 년도의 마지막 2자리
  const month = date.getMonth() + 1; // 월 (0부터 시작하므로 +1)
  return `${year}년${month}월`;
}

export function getAirlineByCode(code: string, airlines: AirlineInfo[]): AirlineInfo | null {
  const upperCode = code.trim().toUpperCase();
  
  return airlines.find(airline => 
    airline.iata.toUpperCase() === upperCode ||
    airline.icao.toUpperCase() === upperCode
  ) || null;
}

// ICAO 코드를 IATA 코드로 변환
export function convertICAOtoIATA(icaoCode: string): string {
  const icaoToIataMap: { [key: string]: string } = {
    'AAR': 'OZ',  // Asiana Airlines
    'KAL': 'KE',  // Korean Air
    'JJA': '7C',  // Jeju Air
    'TWB': 'TW',  // T'way Air
    'ABL': 'BX',  // Air Busan
    'ESR': 'ZE',  // Eastar Jet
    'JNA': 'LJ',  // Jin Air
    'ASV': 'RS',  // Air Seoul
    'APZ': 'YP',  // Air Premia
    'EOK': 'RF',  // Aerokorea
    'ANA': 'NH',  // All Nippon Airways
    'JAL': 'JL',  // Japan Airlines
    'APJ': 'MM',  // Peach Aviation
  };
  
  const upperCode = icaoCode.toUpperCase();
  return icaoToIataMap[upperCode] || icaoCode;
}

// 항공편 번호에서 ICAO 코드를 추출하여 IATA 코드로 변환된 항공편 번호 반환
export function convertFlightNumberToIATA(flightNumber: string): string {
  const upperFlight = flightNumber.toUpperCase().trim();
  
  console.log('🔍 ICAO→IATA 변환 시작:', upperFlight);
  
  // 항공편 번호에서 항공사 코드와 번호 분리
  const match = upperFlight.match(/^([A-Z]{2,3})(\d+)$/);
  if (!match) {
    console.log('⚠️ 항공편 번호 형식 불일치:', upperFlight);
    return upperFlight;
  }
  
  const [, airlineCode, number] = match;
  console.log('🔍 항공사 코드:', airlineCode, '번호:', number);
  
  // 3글자인 경우 ICAO 코드일 가능성이 높음
  if (airlineCode.length === 3) {
    const iataCode = convertICAOtoIATA(airlineCode);
    const converted = `${iataCode}${number}`;
    console.log('✅ ICAO→IATA 변환:', upperFlight, '→', converted);
    return converted;
  }
  
  console.log('✅ 이미 IATA 코드:', upperFlight);
  return upperFlight;
}
