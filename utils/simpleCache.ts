import { Flight } from './indexedDBCache';

interface CacheData {
  flights: Flight[];
  lastUpdated: number;
  userId: string;
}

class SimpleCache {
  private readonly CACHE_KEY = 'flight_dashboard_cache';
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24시간

  // 데이터 캐시 저장 (용량 초과 방지)
  saveFlights(flights: Flight[], userId: string): void {
    try {
      // 더 작은 청크로 분할 (용량 제한 고려)
      const maxChunkSize = 25; // 한 번에 저장할 최대 항목 수
      const chunks = this.chunkArray(flights, maxChunkSize);
      
      // 메타데이터 저장
      const metadata = {
        totalFlights: flights.length,
        chunks: chunks.length,
        lastUpdated: Date.now(),
        userId
      };
      
      localStorage.setItem(`${this.CACHE_KEY}_metadata`, JSON.stringify(metadata));
      
      // 청크별로 저장 (극도로 압축된 데이터)
      chunks.forEach((chunk, index) => {
        const chunkKey = `${this.CACHE_KEY}_chunk_${index}`;
        // 필수 데이터만 저장하여 용량 최소화
        const compressedChunk = chunk.map(flight => ({
          id: flight.id,
          fn: flight.flightNumber, // 축약된 키명
          al: flight.airline,      // 축약된 키명
          d: flight.departure,     // 축약된 키명
          a: flight.arrival,       // 축약된 키명
          dt: flight.date,         // 축약된 키명
          t: flight.time,          // 축약된 키명
          ac: flight.aircraft,     // 축약된 키명
          s: flight.status,        // 축약된 키명
        }));
        localStorage.setItem(chunkKey, JSON.stringify(compressedChunk));
      });
      
      console.log(`✅ 캐시 저장 성공: ${flights.length}개 항공편을 ${chunks.length}개 청크로 분할하여 저장`);
      
    } catch (error) {
      console.error('캐시 저장 실패:', error);
      
      // 용량 초과 시 기존 캐시 정리 후 재시도
      if (error.name === 'QuotaExceededError') {
        console.log('⚠️ localStorage 용량 초과, 기존 캐시 정리 후 재시도');
        this.clearCache();
        
        try {
          // 더 작은 청크로 재시도 (용량 제한 고려)
          const smallerChunks = this.chunkArray(flights, 15);
          const metadata = {
            totalFlights: flights.length,
            chunks: smallerChunks.length,
            lastUpdated: Date.now(),
            userId
          };
          
          localStorage.setItem(`${this.CACHE_KEY}_metadata`, JSON.stringify(metadata));
          
          smallerChunks.forEach((chunk, index) => {
            const chunkKey = `${this.CACHE_KEY}_chunk_${index}`;
            // 극도로 압축된 데이터
            const compressedChunk = chunk.map(flight => ({
              id: flight.id,
              fn: flight.flightNumber,
              al: flight.airline,
              d: flight.departure,
              a: flight.arrival,
              dt: flight.date,
              t: flight.time,
              ac: flight.aircraft,
              s: flight.status,
            }));
            localStorage.setItem(chunkKey, JSON.stringify(compressedChunk));
          });
          
          console.log(`✅ 재시도 성공: ${flights.length}개 항공편을 ${smallerChunks.length}개 작은 청크로 저장`);
        } catch (retryError) {
          console.error('재시도 실패:', retryError);
        }
      }
    }
  }

  // 배열을 청크로 분할하는 헬퍼 함수
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // 캐시된 데이터 로드 (청크 방식)
  loadFlights(userId: string): Flight[] | null {
    try {
      // 메타데이터 확인
      const metadataStr = localStorage.getItem(`${this.CACHE_KEY}_metadata`);
      if (!metadataStr) return null;

      const metadata = JSON.parse(metadataStr);
      
      // 사용자 ID 확인
      if (metadata.userId !== userId) {
        this.clearCache();
        return null;
      }

      // 캐시 만료 확인
      if (Date.now() - metadata.lastUpdated > this.CACHE_DURATION) {
        this.clearCache();
        return null;
      }

      // 모든 청크를 로드하여 합치기
      const allFlights: Flight[] = [];
      for (let i = 0; i < metadata.chunks; i++) {
        const chunkKey = `${this.CACHE_KEY}_chunk_${i}`;
        const chunkStr = localStorage.getItem(chunkKey);
        
        if (chunkStr) {
          const chunk = JSON.parse(chunkStr);
          // 압축된 데이터를 원래 형태로 복원
          const restoredChunk = chunk.map((compressedFlight: any) => ({
            id: compressedFlight.id,
            flightNumber: compressedFlight.fn,
            airline: compressedFlight.al,
            departure: compressedFlight.d,
            arrival: compressedFlight.a,
            date: compressedFlight.dt,
            time: compressedFlight.t,
            aircraft: compressedFlight.ac,
            status: compressedFlight.s,
            // 기본값 설정
            userId: userId,
            timestamp: Date.now()
          }));
          allFlights.push(...restoredChunk);
        }
      }

      console.log(`✅ 캐시 로드 성공: ${allFlights.length}개 항공편을 ${metadata.chunks}개 청크에서 복원`);
      return allFlights;
      
    } catch (error) {
      console.error('캐시 로드 실패:', error);
      this.clearCache();
      return null;
    }
  }

  // 캐시 삭제 (청크 방식)
  clearCache(): void {
    try {
      // 메타데이터 확인
      const metadataStr = localStorage.getItem(`${this.CACHE_KEY}_metadata`);
      if (metadataStr) {
        const metadata = JSON.parse(metadataStr);
        
        // 모든 청크 삭제
        for (let i = 0; i < metadata.chunks; i++) {
          const chunkKey = `${this.CACHE_KEY}_chunk_${i}`;
          localStorage.removeItem(chunkKey);
        }
      }
      
      // 메타데이터 삭제
      localStorage.removeItem(`${this.CACHE_KEY}_metadata`);
      
      // 기존 단일 캐시도 삭제 (하위 호환성)
      localStorage.removeItem(this.CACHE_KEY);
      
      console.log('🗑️ 캐시 정리 완료');
    } catch (error) {
      console.error('캐시 정리 실패:', error);
    }
  }

  // 캐시 상태 확인
  getCacheStatus(userId: string): { hasCache: boolean; lastUpdated: Date | null } {
    try {
      const metadataStr = localStorage.getItem(`${this.CACHE_KEY}_metadata`);
      if (!metadataStr) return { hasCache: false, lastUpdated: null };

      const metadata = JSON.parse(metadataStr);
      if (metadata.userId !== userId) {
        return { hasCache: false, lastUpdated: null };
      }

      return {
        hasCache: true,
        lastUpdated: new Date(metadata.lastUpdated)
      };
    } catch {
      return { hasCache: false, lastUpdated: null };
    }
  }
}

export const simpleCache = new SimpleCache();
