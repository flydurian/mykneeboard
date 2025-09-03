import { indexedDBCache, Flight } from './indexedDBCache';

export interface SeparatedFlightData {
  international: Flight[];
  domestic: Flight[];
  lastUpdated: number;
}

export class SeparatedCache {
  private readonly INTERNATIONAL_KEY = 'international_flights';
  private readonly DOMESTIC_KEY = 'domestic_flights';
  private readonly METADATA_KEY = 'separated_metadata';

  // 국제선과 국내선을 분리하여 저장
  async saveSeparatedFlights(flights: Flight[], userId: string): Promise<void> {
    try {
      // 국제선과 국내선 분리
      const international = flights.filter(flight => 
        flight.departure && flight.arrival && 
        (flight.departure.length === 3 && flight.arrival.length === 3) ||
        (flight.departure !== 'ICN' && flight.arrival !== 'ICN')
      );
      
      const domestic = flights.filter(flight => 
        flight.departure && flight.arrival && 
        (flight.departure === 'ICN' || flight.arrival === 'ICN') &&
        (flight.departure.length === 3 && flight.arrival.length === 3)
      );

      console.log(`🌍 국제선: ${international.length}개, 🇰🇷 국내선: ${domestic.length}개 분리 완료`);

      // 별도로 저장
      await Promise.all([
        this.saveToIndexedDB(this.INTERNATIONAL_KEY, international, userId),
        this.saveToIndexedDB(this.DOMESTIC_KEY, domestic, userId)
      ]);

      // 메타데이터 저장
      const metadata: SeparatedFlightData = {
        international,
        domestic,
        lastUpdated: Date.now()
      };

      await this.saveMetadata(metadata, userId);
      console.log('✅ 분리된 캐시 저장 완료');
    } catch (error) {
      console.error('❌ 분리된 캐시 저장 실패:', error);
      throw error;
    }
  }

  // IndexedDB에 분리된 데이터 저장
  private async saveToIndexedDB(key: string, flights: Flight[], userId: string): Promise<void> {
    try {
      const db = await indexedDBCache['getDB']();
      const transaction = db.transaction(['flights'], 'readwrite');
      const flightStore = transaction.objectStore('flights');

      // 기존 데이터 삭제
      this.clearExistingDataInTransaction(flightStore, key, userId);

      // 새 데이터 저장
      for (let i = 0; i < flights.length; i++) {
        const flight = flights[i];
        const flightWithKey = {
          ...flight,
          userId,
          cacheKey: key,
          timestamp: Date.now(),
          id: this.generateUniqueId(flight, i, userId, key) // 고유 ID 생성
        };
        flightStore.put(flightWithKey);
      }

      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error(`❌ ${key} 저장 실패:`, error);
      throw error;
    }
  }

  // IndexedDB에서 분리된 데이터 로드
  private async getFromIndexedDB(key: string, userId: string): Promise<Flight[]> {
    try {
      const db = await indexedDBCache['getDB']();
      const transaction = db.transaction(['flights'], 'readonly');
      const flightStore = transaction.objectStore('flights');
      
      const request = flightStore.index('userId').getAll(userId);
      const allFlights = await new Promise<Flight[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // 특정 키로 필터링
      return allFlights.filter(flight => (flight as any).cacheKey === key);
    } catch (error) {
      console.error(`❌ ${key} 로드 실패:`, error);
      return [];
    }
  }

  // 메타데이터 저장
  private async saveMetadata(metadata: SeparatedFlightData, userId: string): Promise<void> {
    try {
      const db = await indexedDBCache['getDB']();
      const transaction = db.transaction(['metadata'], 'readwrite');
      const metadataStore = transaction.objectStore('metadata');
      
      const metadataWithKey = {
        userId: `${userId}_separated`,
        data: metadata,
        timestamp: Date.now()
      };
      
      metadataStore.put(metadataWithKey);

      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('❌ 메타데이터 저장 실패:', error);
      throw error;
    }
  }

  // 분리된 데이터 로드
  async loadSeparatedFlights(userId: string): Promise<SeparatedFlightData | null> {
    try {
      const db = await indexedDBCache['getDB']();
      const transaction = db.transaction(['metadata'], 'readonly');
      const metadataStore = transaction.objectStore('metadata');
      
      const request = metadataStore.get(`${userId}_separated`);
      const result = await new Promise<any>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!result) {
        console.log('⚠️ 분리된 캐시 데이터 없음');
        return null;
      }

      // 캐시 만료 확인 (24시간)
      const cacheAge = Date.now() - result.timestamp;
      if (cacheAge > 24 * 60 * 60 * 1000) {
        console.log('⚠️ 분리된 캐시 만료됨');
        await this.clearSeparatedCache(userId);
        return null;
      }

      console.log('✅ 분리된 캐시 데이터 로드 완료');
      return result.data;
    } catch (error) {
      console.error('❌ 분리된 캐시 로드 실패:', error);
      return null;
    }
  }

  // 분리된 캐시 정리
  async clearSeparatedCache(userId: string): Promise<void> {
    try {
      const db = await indexedDBCache['getDB']();
      const transaction = db.transaction(['flights', 'metadata'], 'readwrite');
      
      const flightStore = transaction.objectStore('flights');
      const metadataStore = transaction.objectStore('metadata');

      // 관련 데이터 삭제
      const allFlights = await this.getAllFlightsFromIndexedDB(userId);
      for (const flight of allFlights) {
        if ((flight as any).cacheKey) {
          flightStore.delete(flight.id);
        }
      }

      // 메타데이터 삭제
      metadataStore.delete(`${userId}_separated`);

      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });

      console.log('🗑️ 분리된 캐시 정리 완료');
    } catch (error) {
      console.error('❌ 분리된 캐시 정리 실패:', error);
    }
  }

  // IndexedDB에서 모든 비행 데이터 가져오기
  private async getAllFlightsFromIndexedDB(userId: string): Promise<Flight[]> {
    try {
      const db = await indexedDBCache['getDB']();
      const transaction = db.transaction(['flights'], 'readonly');
      const flightStore = transaction.objectStore('flights');
      
      const request = flightStore.index('userId').getAll(userId);
      return await new Promise<Flight[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('❌ IndexedDB 데이터 조회 실패:', error);
      return [];
    }
  }

  // 기존 데이터 삭제 (트랜잭션 내에서)
  private clearExistingDataInTransaction(flightStore: IDBObjectStore, key: string, userId: string): void {
    const index = flightStore.index('userId');
    const request = index.openCursor(userId);
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const flight = cursor.value;
        // 특정 키로 필터링하여 삭제
        if ((flight as any).cacheKey === key) {
          flightStore.delete(cursor.primaryKey);
        }
        cursor.continue();
      }
    };
  }

  // 고유 ID 생성 함수 (성능 최적화)
  private generateUniqueId(flight: Flight, index: number, userId: string, cacheKey: string): string {
    // 기존 ID가 있고 유효한 경우 사용
    if (flight.id && flight.id !== '' && flight.id !== 'undefined') {
      return flight.id;
    }
    
    // 성능 최적화: 간단한 조합으로 고유 ID 생성
    const timestamp = Date.now();
    return `${cacheKey}_${timestamp}_${index}`;
  }

  // 캐시 상태 확인
  async getSeparatedCacheStatus(userId: string): Promise<{
    international: { exists: boolean; count: number };
    domestic: { exists: boolean; count: number };
    lastUpdated: number | null;
  }> {
    try {
      const metadata = await this.loadSeparatedFlights(userId);
      
      if (!metadata) {
        return {
          international: { exists: false, count: 0 },
          domestic: { exists: false, count: 0 },
          lastUpdated: null
        };
      }

      return {
        international: { exists: true, count: metadata.international.length },
        domestic: { exists: true, count: metadata.domestic.length },
        lastUpdated: metadata.lastUpdated
      };
    } catch (error) {
      console.error('❌ 분리된 캐시 상태 확인 실패:', error);
      return {
        international: { exists: false, count: 0 },
        domestic: { exists: false, count: 0 },
        lastUpdated: null
      };
    }
  }
}

export const separatedCache = new SeparatedCache();
