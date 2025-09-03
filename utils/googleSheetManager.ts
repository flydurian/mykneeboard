import { GoogleSheetFlightData, GoogleSheetMetadata } from '../types';

export class GoogleSheetManager {
  private readonly GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycby229kWBwCFIlM-bPZFiBG847b8Rr4ineX5StiFRJG4QE0KUayp3OKMrm61lrk4OqRN/exec';
  private readonly DB_NAME = 'MyKneeBoardDB';
  private readonly STORE_NAME = 'googleSheetFlights';
  private readonly META_STORE = 'googleSheetMetadata';

  /**
   * 구글 스프레드시트에서 데이터 가져오기
   */
  async fetchFromGoogleSheet(): Promise<GoogleSheetFlightData[]> {
    try {
      console.log('🔄 구글 스프레드시트에서 데이터 가져오는 중...');
      
      const response = await fetch(this.GOOGLE_SHEET_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ 구글 스프레드시트 데이터 로드 완료:', data.length, '개 레코드');
      
      return this.parseGoogleSheetData(data);
    } catch (error) {
      console.error('❌ 구글 스프레드시트 데이터 가져오기 실패:', error);
      throw error;
    }
  }

  /**
   * 구글 스프레드시트 데이터 파싱
   */
  private parseGoogleSheetData(rawData: any[]): GoogleSheetFlightData[] {
    return rawData.map((row, index) => {
      // 첫 번째 행은 헤더이므로 건너뛰기
      if (index === 0) return null;
      
      return {
        date: row[0] || '',
        flightNumber: row[1] || '',
        departure: row[2] || '',
        arrival: row[3] || '',
        departureTime: row[4] || '',
        arrivalTime: row[5] || '',
        aircraft: row[6] || '',
        captain: row[7] || '',
        firstOfficer: row[8] || '',
        flightTime: row[9] || '',
        restTime: row[10] || '',
        notes: row[11] || ''
      };
    }).filter(Boolean) as GoogleSheetFlightData[];
  }

  /**
   * IndexedDB 초기화
   */
  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 항공편 데이터 저장소
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const flightStore = db.createObjectStore(this.STORE_NAME, { keyPath: 'id', autoIncrement: true });
          flightStore.createIndex('date', 'date', { unique: false });
          flightStore.createIndex('flightNumber', 'flightNumber', { unique: false });
        }
        
        // 메타데이터 저장소
        if (!db.objectStoreNames.contains(this.META_STORE)) {
          const metaStore = db.createObjectStore(this.META_STORE, { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * IndexedDB에 데이터 저장
   */
  async saveToIndexedDB(flightData: GoogleSheetFlightData[]): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME, this.META_STORE], 'readwrite');
      
      // 기존 데이터 삭제
      const flightStore = transaction.objectStore(this.STORE_NAME);
      await this.clearStore(flightStore);
      
      // 새 데이터 저장
      for (const flight of flightData) {
        flightStore.add(flight);
      }
      
      // 메타데이터 저장
      const metaStore = transaction.objectStore(this.META_STORE);
      const metadata: GoogleSheetMetadata = {
        lastUpdated: new Date().toISOString(),
        version: '1.0',
        totalRecords: flightData.length
      };
      
      metaStore.put({ id: 'current', ...metadata });
      
      await this.waitForTransaction(transaction);
      console.log('✅ IndexedDB에 데이터 저장 완료:', flightData.length, '개 레코드');
    } catch (error) {
      console.error('❌ IndexedDB 저장 실패:', error);
      throw error;
    }
  }

  /**
   * IndexedDB에서 데이터 로드
   */
  async loadFromIndexedDB(): Promise<GoogleSheetFlightData[]> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();
      
      return new Promise((resolve, reject) => {
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    } catch (error) {
      console.error('❌ IndexedDB에서 데이터 로드 실패:', error);
      return [];
    }
  }

  /**
   * 메타데이터 로드
   */
  async loadMetadata(): Promise<GoogleSheetMetadata | null> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.META_STORE], 'readonly');
      const store = transaction.objectStore(this.META_STORE);
      const request = store.get('current');
      
      return new Promise((resolve, reject) => {
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || null);
      });
    } catch (error) {
      console.error('❌ 메타데이터 로드 실패:', error);
      return null;
    }
  }

  /**
   * 데이터 동기화 (스마트 업데이트)
   */
  async syncData(): Promise<{
    updated: boolean;
    recordCount: number;
    message: string;
  }> {
    try {
      console.log('🔄 데이터 동기화 시작...');
      
      // 로컬 메타데이터 확인
      const localMetadata = await this.loadMetadata();
      const localLastUpdated = localMetadata?.lastUpdated;
      
      // 구글 스프레드시트에서 데이터 가져오기
      const googleData = await this.fetchFromGoogleSheet();
      
      if (!googleData || googleData.length === 0) {
        return {
          updated: false,
          recordCount: 0,
          message: '구글 스프레드시트에서 데이터를 가져올 수 없습니다.'
        };
      }
      
      // 데이터 비교 및 업데이트 결정
      if (this.shouldUpdateData(localLastUpdated, googleData)) {
        await this.saveToIndexedDB(googleData);
        return {
          updated: true,
          recordCount: googleData.length,
          message: `데이터가 성공적으로 업데이트되었습니다. (${googleData.length}개 레코드)`
        };
      } else {
        return {
          updated: false,
          recordCount: googleData.length,
          message: '로컬 데이터가 최신입니다. 업데이트가 필요하지 않습니다.'
        };
      }
    } catch (error) {
      console.error('❌ 데이터 동기화 실패:', error);
      throw error;
    }
  }

  /**
   * 업데이트 필요 여부 판단
   */
  private shouldUpdateData(localLastUpdated: string | undefined, googleData: GoogleSheetFlightData[]): boolean {
    // 로컬 데이터가 없으면 업데이트
    if (!localLastUpdated) {
      console.log('📝 로컬 데이터가 없습니다. 초기 데이터를 가져옵니다.');
      return true;
    }
    
    // 구글 데이터가 더 많으면 업데이트 (간단한 로직)
    const localCount = 0; // 실제로는 로컬 데이터 개수를 확인해야 함
    if (googleData.length > localCount) {
      console.log('📝 구글 데이터가 더 많습니다. 업데이트합니다.');
      return true;
    }
    
    // 시간 기반 업데이트 (24시간마다)
    const localTime = new Date(localLastUpdated).getTime();
    const currentTime = new Date().getTime();
    const hoursDiff = (currentTime - localTime) / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
      console.log('📝 24시간이 지났습니다. 데이터를 새로고침합니다.');
      return true;
    }
    
    console.log('✅ 로컬 데이터가 최신입니다.');
    return false;
  }

  /**
   * 저장소 초기화
   */
  private async clearStore(store: IDBObjectStore): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * 트랜잭션 완료 대기
   */
  private async waitForTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * 데이터베이스 초기화 (테스트용)
   */
  async resetDatabase(): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.STORE_NAME, this.META_STORE], 'readwrite');
      
      await this.clearStore(transaction.objectStore(this.STORE_NAME));
      await this.clearStore(transaction.objectStore(this.META_STORE));
      
      await this.waitForTransaction(transaction);
      console.log('✅ 데이터베이스 초기화 완료');
    } catch (error) {
      console.error('❌ 데이터베이스 초기화 실패:', error);
      throw error;
    }
  }
}
