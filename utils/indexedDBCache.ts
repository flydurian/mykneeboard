export interface Flight {
  id: string;
  flightNumber: string;
  airline: string;
  departure: string;
  arrival: string;
  date: string;
  time: string;
  aircraft: string;
  status: string;
  type?: string;
  duration?: string;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  operatingDays?: string;
}

export class IndexedDBCache {
  private readonly DB_NAME = 'FlightDashboardDB';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'flights';
  private readonly METADATA_STORE = 'metadata';
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24시간

  private db: IDBDatabase | null = null;

  // IndexedDB 초기화
  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 비행 데이터 저장소
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const flightStore = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          flightStore.createIndex('userId', 'userId', { unique: false });
          flightStore.createIndex('date', 'date', { unique: false });
          flightStore.createIndex('airline', 'airline', { unique: false });
        }

        // 메타데이터 저장소
        if (!db.objectStoreNames.contains(this.METADATA_STORE)) {
          const metadataStore = db.createObjectStore(this.METADATA_STORE, { keyPath: 'userId' });
        }
      };
    });
  }

  // 데이터베이스 연결 가져오기
  private async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = await this.initDB();
    }
    return this.db;
  }

  // 비행 데이터 저장 (용량 제한 없음 + 극한 성능 최적화)
  async saveFlights(flights: Flight[], userId: string): Promise<void> {
    if (!this.db) {
      console.error("데이터베이스가 초기화되지 않았습니다.");
      return Promise.reject(new Error("Database not initialized."));
    }

    // 극한 성능 최적화: 배치 크기 대폭 증가
    const BATCH_SIZE = 5000; // 배치 크기 대폭 증가로 성능 극한 향상
    const batches = this.createBatches(flights, BATCH_SIZE);
    
    console.log(`📦 ${flights.length}개 데이터를 ${batches.length}개 배치로 분할하여 처리`);
    
    // 병렬 처리로 성능 극한 향상
    const batchPromises = batches.map((batch, index) => 
      this.saveBatch(batch, userId, index === 0)
    );
    
    await Promise.all(batchPromises);
    
    console.log(`✅ IndexedDB에 ${flights.length}개 비행 데이터 저장 완료`);
  }

  // 비행 데이터 로드
  async loadFlights(userId: string): Promise<Flight[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.STORE_NAME, this.METADATA_STORE], 'readonly');
      
      const flightStore = transaction.objectStore(this.STORE_NAME);
      const metadataStore = transaction.objectStore(this.METADATA_STORE);

      // 메타데이터 확인
      const metadataRequest = metadataStore.get(userId);
      const metadata = await new Promise<any>((resolve, reject) => {
        metadataRequest.onsuccess = () => resolve(metadataRequest.result);
        metadataRequest.onerror = () => reject(metadataRequest.error);
      });

      if (!metadata) {
        console.log('⚠️ IndexedDB에 캐시된 데이터 없음');
        return [];
      }

      // 캐시 만료 확인
      if (Date.now() > metadata.cacheExpiry) {
        console.log('⚠️ 캐시 만료됨, 데이터 삭제');
        await this.clearCache(userId);
        return [];
      }

      // 비행 데이터 로드
      const flightRequest = flightStore.index('userId').getAll(userId);
      const flights = await new Promise<Flight[]>((resolve, reject) => {
        flightRequest.onsuccess = () => resolve(flightRequest.result);
        flightRequest.onerror = () => reject(flightRequest.error);
      });

      console.log(`✅ IndexedDB에서 ${flights.length}개 비행 데이터 로드 완료`);
      return flights;
    } catch (error) {
      console.error('❌ IndexedDB 로드 실패:', error);
      return [];
    }
  }

  // 캐시 정리
  async clearCache(userId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.STORE_NAME, this.METADATA_STORE], 'readwrite');
      
      const flightStore = transaction.objectStore(this.STORE_NAME);
      const metadataStore = transaction.objectStore(this.METADATA_STORE);

      // 사용자 데이터 삭제
      const existingData = await this.getFlights(userId);
      for (const flight of existingData) {
        flightStore.delete(flight.id);
      }

      // 메타데이터 삭제
      metadataStore.delete(userId);

      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });

      console.log('🗑️ IndexedDB 캐시 정리 완료');
    } catch (error) {
      console.error('❌ IndexedDB 캐시 정리 실패:', error);
    }
  }

  // 개별 비행 데이터 가져오기 (getFlights 메서드)
  private async getFlights(userId: string): Promise<Flight[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const flightStore = transaction.objectStore(this.STORE_NAME);
      
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

  // 캐시 상태 확인
  async getCacheStatus(userId: string): Promise<{ exists: boolean; count: number; lastUpdated: number | null }> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.METADATA_STORE], 'readonly');
      const metadataStore = transaction.objectStore(this.METADATA_STORE);
      
      const request = metadataStore.get(userId);
      const metadata = await new Promise<any>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!metadata) {
        return { exists: false, count: 0, lastUpdated: null };
      }

      return {
        exists: true,
        count: metadata.totalFlights,
        lastUpdated: metadata.lastUpdated
      };
    } catch (error) {
      console.error('❌ 캐시 상태 확인 실패:', error);
      return { exists: false, count: 0, lastUpdated: null };
    }
  }

  // 트랜잭션 내에서 기존 데이터 삭제
  private clearExistingDataInTransaction(flightStore: IDBObjectStore, userId: string): void {
    const index = flightStore.index('userId');
    const request = index.openCursor(userId);
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        flightStore.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
  }

  // 고유 ID 생성 함수
  private generateUniqueId(flight: Flight, index: number, userId: string): string {
    // 기존 ID가 있고 유효한 경우 사용
    if (flight.id && flight.id !== '' && flight.id !== 'undefined') {
      return flight.id;
    }
    
    // 고유 ID 생성: 항공사-항공편번호-날짜-시간-출발지-도착지 조합
    const date = flight.date || 'unknown-date';
    const time = flight.time || 'unknown-time';
    const airline = flight.airline || 'unknown-airline';
    const flightNumber = flight.flightNumber || 'unknown-flight';
    const departure = flight.departure || 'unknown-dep';
    const arrival = flight.arrival || 'unknown-arr';
    
    // 특수문자 제거 및 안전한 문자열 생성
    const safeId = `${airline}_${flightNumber}_${date}_${time}_${departure}_${arrival}_${index}`;
    
    // URL 안전한 문자열로 변환
    return safeId
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase();
  }

  // 데이터를 배치로 분할하는 도우미 함수
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  // 개별 배치를 저장하는 도우미 함수
  private async saveBatch(batch: Flight[], userId: string, isFirstBatch: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME, this.METADATA_STORE], 'readwrite');
      const flightStore = transaction.objectStore(this.STORE_NAME);
      const metadataStore = transaction.objectStore(this.METADATA_STORE);
      
      let successCount = 0;

      // 트랜잭션 완료/실패 이벤트 등록
      transaction.oncomplete = () => {
        console.log(`✅ 배치 ${isFirstBatch ? '첫' : ''} 트랜잭션 완전 성공: ${successCount}개 항공편 저장 완료.`);
        resolve();
      };

      transaction.onerror = () => {
        console.error("❌ 배치 트랜잭션 처리 중 오류 발생:", transaction.error);
        reject(transaction.error);
      };

      // 배치 내 데이터 저장
      try {
        // 기존 데이터 삭제 (트랜잭션 내에서)
        this.clearExistingDataInTransaction(flightStore, userId);

        // 새 데이터 저장
        batch.forEach((flight, index) => {
          // 고유 ID 생성 로직
          const uniqueId = this.generateUniqueId(flight, index, userId);
          const flightWithId = { 
            ...flight, 
            id: uniqueId,
            userId, 
            timestamp: Date.now() 
          };
          
          const request = flightStore.put(flightWithId);
          
          request.onsuccess = () => {
            successCount++;
          };
          // 개별 request.onerror는 transaction.onerror가 처리하므로 생략 가능
        });

        // 메타데이터 저장
        const metadata = {
          userId,
          totalFlights: batch.length, // 배치 단위로 카운트
          lastUpdated: Date.now(),
          cacheExpiry: Date.now() + this.CACHE_DURATION
        };
        metadataStore.put(metadata);

      } catch (error) {
        // forEach 루프 자체에서 동기적인 에러가 날 경우를 대비
        console.error("데이터 처리 중 예외 발생:", error);
        reject(error);
      }
    });
  }
}

export const indexedDBCache = new IndexedDBCache();
