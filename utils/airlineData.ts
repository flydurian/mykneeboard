import { worldAirlines, AIRLINE_DATA_LAST_MODIFIED, AirlineInfo } from '../data/worldAirlines';

export interface AirlineInfo {
  iata: string;
  icao: string;
  name: string;
  koreanName: string;
  callsign: string;
  country: string;
}

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
