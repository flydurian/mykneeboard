import { Flight } from '../types';

export class IndexedDBCache {
  private readonly DB_NAME = 'FlightDashboardDB';
  private readonly DB_VERSION = 7; // 사용자 설정 저장소 추가
  private readonly STORE_NAME = 'flights';
  private readonly METADATA_STORE = 'metadata';
  private readonly CREW_MEMOS_STORE = 'crewMemos';
  private readonly CITY_MEMOS_STORE = 'cityMemos';
  private readonly REST_INFO_STORE = 'restInfo';
  private readonly USER_SETTINGS_STORE = 'userSettings';
  private readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7일 - 장시간 비행모드 대응

  private db: IDBDatabase | null = null;

  // IndexedDB 초기화
  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;
        
        
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

        // 승무원 메모 저장소
        if (!db.objectStoreNames.contains(this.CREW_MEMOS_STORE)) {
          const crewMemosStore = db.createObjectStore(this.CREW_MEMOS_STORE, { keyPath: 'id' });
          crewMemosStore.createIndex('userId', 'userId', { unique: false });
        }

        // 도시 메모 저장소
        if (!db.objectStoreNames.contains(this.CITY_MEMOS_STORE)) {
          const cityMemosStore = db.createObjectStore(this.CITY_MEMOS_STORE, { keyPath: 'id' });
          cityMemosStore.createIndex('userId', 'userId', { unique: false });
        }

        // REST 정보 저장소
        if (!db.objectStoreNames.contains(this.REST_INFO_STORE)) {
          const restInfoStore = db.createObjectStore(this.REST_INFO_STORE, { keyPath: 'userId' });
        }

        // 사용자 설정 저장소 (회사/베이스)
        if (!db.objectStoreNames.contains(this.USER_SETTINGS_STORE)) {
          const userSettingsStore = db.createObjectStore(this.USER_SETTINGS_STORE, { keyPath: 'userId' });
        }
      };
    });
  }

  // 사용자 설정 저장 (회사/베이스)
  async saveUserSettings(userId: string, settings: { company?: string; base?: string }): Promise<void> {
    try {
      const db = await this.getDB();
      if (!db.objectStoreNames.contains(this.USER_SETTINGS_STORE)) return;
      const tx = db.transaction([this.USER_SETTINGS_STORE], 'readwrite');
      const store = tx.objectStore(this.USER_SETTINGS_STORE);
      const data = { userId, ...settings, timestamp: Date.now() };
      store.put(data);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error('❌ IndexedDB 사용자 설정 저장 실패:', e);
    }
  }

  // 사용자 설정 불러오기
  async loadUserSettings(userId: string): Promise<{ company?: string; base?: string } | null> {
    try {
      const db = await this.getDB();
      if (!db.objectStoreNames.contains(this.USER_SETTINGS_STORE)) return null;
      const tx = db.transaction([this.USER_SETTINGS_STORE], 'readonly');
      const store = tx.objectStore(this.USER_SETTINGS_STORE);
      const req = store.get(userId);
      const res = await new Promise<any>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (!res) return null;
      return { company: res.company, base: res.base };
    } catch (e) {
      console.error('❌ IndexedDB 사용자 설정 로드 실패:', e);
      return null;
    }
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
    
    
    // 병렬 처리로 성능 극한 향상
    const batchPromises = batches.map((batch, index) => 
      this.saveBatch(batch, userId, index === 0)
    );
    
    await Promise.all(batchPromises);
    
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
        return [];
      }

      // 캐시 만료 확인 (오프라인에서는 만료된 데이터도 허용)
      if (Date.now() > metadata.cacheExpiry && navigator.onLine) {
        await this.clearCache(userId);
        return [];
      }

      // 비행 데이터 로드
      const flightRequest = flightStore.index('userId').getAll(userId);
      const flights = await new Promise<Flight[]>((resolve, reject) => {
        flightRequest.onsuccess = () => resolve(flightRequest.result);
        flightRequest.onerror = () => reject(flightRequest.error);
      });

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

      // 사용자 데이터 삭제 - 같은 트랜잭션 내에서 직접 조회
      const userDataRequest = flightStore.getAll();
      const userData = await new Promise<any[]>((resolve, reject) => {
        userDataRequest.onsuccess = () => resolve(userDataRequest.result);
        userDataRequest.onerror = () => reject(userDataRequest.error);
      });

      // 해당 사용자의 데이터만 필터링하여 삭제
      const userFlights = userData.filter(flight => flight.userId === userId);
      for (const flight of userFlights) {
        flightStore.delete(flight.id);
      }

      // 메타데이터 삭제
      metadataStore.delete(userId);

      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });

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
  private generateUniqueId(flight: Flight, index: number, userId: string): number {
    // 기존 ID가 있고 유효한 경우 사용
    if (flight.id && flight.id > 0) {
      return flight.id;
    }
    
    // 고유 숫자 ID 생성: 타임스탬프 + 인덱스
    const timestamp = Date.now();
    return timestamp + index;
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

  // 승무원 메모 저장
  async saveCrewMemos(memos: {[key: string]: string}, userId: string): Promise<void> {
    try {
      const db = await this.getDB();
      
      // 저장소가 존재하는지 확인
      if (!db.objectStoreNames.contains(this.CREW_MEMOS_STORE)) {
        return;
      }
      
      const transaction = db.transaction([this.CREW_MEMOS_STORE], 'readwrite');
      const store = transaction.objectStore(this.CREW_MEMOS_STORE);

      // 기존 메모 삭제
      const existingRequest = store.index('userId').openCursor(userId);
      existingRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      // 새 메모 저장
      for (const [crewName, memo] of Object.entries(memos)) {
        if (memo && memo.trim()) {
          const memoData = {
            id: `${userId}_${crewName}`,
            userId,
            crewName,
            memo,
            timestamp: Date.now()
          };
          store.put(memoData);
        }
      }

      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });

    } catch (error) {
      console.error('❌ IndexedDB 승무원 메모 저장 실패:', error);
    }
  }

  // 승무원 메모 불러오기
  async loadCrewMemos(userId: string): Promise<{[key: string]: string}> {
    try {
      const db = await this.getDB();
      
      // 저장소가 존재하는지 확인
      if (!db.objectStoreNames.contains(this.CREW_MEMOS_STORE)) {
        return {};
      }
      
      const transaction = db.transaction([this.CREW_MEMOS_STORE], 'readonly');
      const store = transaction.objectStore(this.CREW_MEMOS_STORE);

      const request = store.index('userId').getAll(userId);
      const memos = await new Promise<any[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const result: {[key: string]: string} = {};
      memos.forEach(memoData => {
        result[memoData.crewName] = memoData.memo;
      });

      return result;
    } catch (error) {
      console.error('❌ IndexedDB 승무원 메모 불러오기 실패:', error);
      return {};
    }
  }

  // 도시 메모 저장
  async saveCityMemos(memos: {[key: string]: string}, userId: string): Promise<void> {
    try {
      const db = await this.getDB();
      
      // 저장소가 존재하는지 확인
      if (!db.objectStoreNames.contains(this.CITY_MEMOS_STORE)) {
        return;
      }
      
      const transaction = db.transaction([this.CITY_MEMOS_STORE], 'readwrite');
      const store = transaction.objectStore(this.CITY_MEMOS_STORE);

      // 기존 메모 삭제
      const existingRequest = store.index('userId').openCursor(userId);
      existingRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      // 새 메모 저장
      for (const [cityCode, memo] of Object.entries(memos)) {
        if (memo && memo.trim()) {
          const memoData = {
            id: `${userId}_${cityCode}`,
            userId,
            cityCode,
            memo,
            timestamp: Date.now()
          };
          store.put(memoData);
        }
      }

      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });

    } catch (error) {
      console.error('❌ IndexedDB 도시 메모 저장 실패:', error);
    }
  }

  // 도시 메모 불러오기
  async loadCityMemos(userId: string): Promise<{[key: string]: string}> {
    try {
      const db = await this.getDB();
      
      // 저장소가 존재하는지 확인
      if (!db.objectStoreNames.contains(this.CITY_MEMOS_STORE)) {
        return {};
      }
      
      const transaction = db.transaction([this.CITY_MEMOS_STORE], 'readonly');
      const store = transaction.objectStore(this.CITY_MEMOS_STORE);

      const request = store.index('userId').getAll(userId);
      const memos = await new Promise<any[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const result: {[key: string]: string} = {};
      memos.forEach(memoData => {
        result[memoData.cityCode] = memoData.memo;
      });

      return result;
    } catch (error) {
      console.error('❌ IndexedDB 도시 메모 불러오기 실패:', error);
      return {};
    }
  }

  // IndexedDB 상태 확인
  async checkIndexedDBStatus(userId: string): Promise<{ flightCount: number; lastSync?: string }> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const flightStore = transaction.objectStore(this.STORE_NAME);
      
      const flightRequest = flightStore.index('userId').getAll(userId);
      const allFlights = await new Promise<Flight[]>((resolve, reject) => {
        flightRequest.onsuccess = () => resolve(flightRequest.result);
        flightRequest.onerror = () => reject(flightRequest.error);
      });
      
      return {
        flightCount: allFlights.length,
        lastSync: allFlights.length > 0 ? allFlights[0].lastModified : undefined
      };
    } catch (error) {
      console.error('❌ IndexedDB 상태 확인 실패:', error);
      return { flightCount: 0 };
    }
  }

  // 비행 데이터 업데이트 (이착륙 상태 등)
  async updateFlight(flightId: number, updates: { status?: any } | any, userId: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const flightStore = transaction.objectStore(this.STORE_NAME);
      
      // userId로 모든 비행 데이터 조회
      const flightRequest = flightStore.index('userId').getAll(userId);
      const allFlights = await new Promise<Flight[]>((resolve, reject) => {
        flightRequest.onsuccess = () => resolve(flightRequest.result);
        flightRequest.onerror = () => reject(flightRequest.error);
      });
      
      // IndexedDB에 비행 데이터가 없는 경우 조용히 넘어감
      if (allFlights.length === 0) {
        return true;
      }
      
      
      // 해당 ID의 비행 데이터 찾기 (타입 변환 고려)
      const flightToUpdate = allFlights.find(flight => 
        flight.id === flightId || 
        String(flight.id) === String(flightId) ||
        Number(flight.id) === flightId
      );
      
      if (!flightToUpdate) {
        // 데이터를 찾지 못해도 오류로 처리하지 않고 성공으로 반환 (Firebase는 저장됨)
        return true;
      }
      
      // 업데이트된 데이터 생성
      const updatedFlight = {
        ...flightToUpdate,
        ...updates,
        lastModified: new Date().toISOString(),
        version: (flightToUpdate.version || 0) + 1
      };
      
      // IndexedDB에 업데이트된 데이터 저장
      await new Promise<void>((resolve, reject) => {
        const updateRequest = flightStore.put(updatedFlight);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      });
      
      return true;
    } catch (error) {
      console.error('❌ IndexedDB 비행 데이터 업데이트 실패:', error);
      // 오류가 발생해도 Firebase는 저장되므로 true 반환
      return true;
    }
  }

  // 비행편 삭제
  async deleteFlight(flightId: number): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(flightId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
    } catch (error) {
      console.error('Error deleting flight from IndexedDB:', error);
      throw error;
    }
  }

  // 비행편 전체 업데이트 (수정 모드에서 사용)
  async updateFlightData(flight: any): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(flight);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
    } catch (error) {
      console.error('Error updating flight in IndexedDB:', error);
      throw error;
    }
  }

  // REST 정보 저장
  async saveRestInfo(restInfo: any, userId: string): Promise<void> {
    const db = await this.initDB();
    const transaction = db.transaction([this.REST_INFO_STORE], 'readwrite');
    const store = transaction.objectStore(this.REST_INFO_STORE);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({ userId, restInfo, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // REST 정보 불러오기
  async loadRestInfo(userId: string): Promise<any> {
    const db = await this.initDB();
    const transaction = db.transaction([this.REST_INFO_STORE], 'readonly');
    const store = transaction.objectStore(this.REST_INFO_STORE);
    
    return new Promise<any>((resolve, reject) => {
      const request = store.get(userId);
      request.onsuccess = () => {
        if (request.result && request.result.restInfo) {
          resolve(request.result.restInfo);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const indexedDBCache = new IndexedDBCache();
