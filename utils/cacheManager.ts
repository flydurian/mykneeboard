import { indexedDBCache } from './indexedDBCache';
import { separatedCache } from './separatedCache';
import { simpleCache } from './simpleCache';

export interface CacheInfo {
  type: 'localStorage' | 'indexedDB' | 'separated';
  exists: boolean;
  count: number;
  lastUpdated: number | null;
  size: string;
  expiry: number | null;
}

export class CacheManager {
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24시간
  private readonly CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24시간마다 정리

  constructor() {
    this.startAutoCleanup();
  }

  // 모든 캐시 상태 확인
  async getAllCacheStatus(userId: string): Promise<{
    localStorage: CacheInfo;
    indexedDB: CacheInfo;
    separated: CacheInfo;
  }> {
    try {
      const [localStorageStatus, indexedDBStatus, separatedStatus] = await Promise.all([
        this.getLocalStorageStatus(userId),
        this.getIndexedDBStatus(userId),
        this.getSeparatedStatus(userId)
      ]);

      return {
        localStorage: localStorageStatus,
        indexedDB: indexedDBStatus,
        separated: separatedStatus
      };
    } catch (error) {
      console.error('❌ 캐시 상태 확인 실패:', error);
      return {
        localStorage: { type: 'localStorage', exists: false, count: 0, lastUpdated: null, size: '0KB', expiry: null },
        indexedDB: { type: 'indexedDB', exists: false, count: 0, lastUpdated: null, size: '0KB', expiry: null },
        separated: { type: 'separated', exists: false, count: 0, lastUpdated: null, size: '0KB', expiry: null }
      };
    }
  }

  // localStorage 상태 확인
  private getLocalStorageStatus(userId: string): CacheInfo {
    try {
      const cacheKey = `flight_dashboard_cache_${userId}`;
      const metadata = localStorage.getItem(`${cacheKey}_metadata`);
      
      if (!metadata) {
        return {
          type: 'localStorage',
          exists: false,
          count: 0,
          lastUpdated: null,
          size: '0KB',
          expiry: null
        };
      }

      const metadataObj = JSON.parse(metadata);
      const lastUpdated = metadataObj.lastUpdated;
      const expiry = lastUpdated + this.CACHE_EXPIRY;
      const isExpired = Date.now() > expiry;

      // 용량 계산
      let totalSize = 0;
      for (let i = 0; i < metadataObj.chunks; i++) {
        const chunkKey = `${cacheKey}_chunk_${i}`;
        const chunk = localStorage.getItem(chunkKey);
        if (chunk) {
          totalSize += new Blob([chunk]).size;
        }
      }

      return {
        type: 'localStorage',
        exists: !isExpired,
        count: metadataObj.totalFlights || 0,
        lastUpdated,
        size: this.formatBytes(totalSize),
        expiry
      };
    } catch (error) {
      console.error('❌ localStorage 상태 확인 실패:', error);
      return {
        type: 'localStorage',
        exists: false,
        count: 0,
        lastUpdated: null,
        size: '0KB',
        expiry: null
      };
    }
  }

  // IndexedDB 상태 확인
  private async getIndexedDBStatus(userId: string): Promise<CacheInfo> {
    try {
      const status = await indexedDBCache.getCacheStatus(userId);
      const lastUpdated = status.lastUpdated;
      const expiry = lastUpdated ? lastUpdated + this.CACHE_EXPIRY : null;
      const isExpired = expiry ? Date.now() > expiry : true;

      return {
        type: 'indexedDB',
        exists: status.exists && !isExpired,
        count: status.count,
        lastUpdated,
        size: 'N/A', // IndexedDB는 용량 제한이 크므로 표시하지 않음
        expiry
      };
    } catch (error) {
      console.error('❌ IndexedDB 상태 확인 실패:', error);
      return {
        type: 'indexedDB',
        exists: false,
        count: 0,
        lastUpdated: null,
        size: 'N/A',
        expiry: null
      };
    }
  }

  // 분리된 캐시 상태 확인
  private async getSeparatedStatus(userId: string): Promise<CacheInfo> {
    try {
      const status = await separatedCache.getSeparatedCacheStatus(userId);
      const lastUpdated = status.lastUpdated;
      const expiry = lastUpdated ? lastUpdated + this.CACHE_EXPIRY : null;
      const isExpired = expiry ? Date.now() > expiry : true;

      return {
        type: 'separated',
        exists: status.international.exists || status.domestic.exists,
        count: (status.international.exists ? status.international.count : 0) + 
               (status.domestic.exists ? status.domestic.count : 0),
        lastUpdated,
        size: 'N/A',
        expiry
      };
    } catch (error) {
      console.error('❌ 분리된 캐시 상태 확인 실패:', error);
      return {
        type: 'separated',
        exists: false,
        count: 0,
        lastUpdated: null,
        size: 'N/A',
        expiry: null
      };
    }
  }

  // 만료된 캐시 정리
  async cleanupExpiredCaches(userId: string): Promise<void> {
    try {
      console.log('🧹 만료된 캐시 정리 시작...');
      
      const status = await this.getAllCacheStatus(userId);
      let cleanedCount = 0;

      // localStorage 정리
      if (status.localStorage.exists && status.localStorage.expiry && Date.now() > status.localStorage.expiry) {
        console.log('🗑️ localStorage 캐시 만료됨, 정리 중...');
        simpleCache.clearCache(userId);
        cleanedCount++;
      }

      // IndexedDB 정리
      if (status.indexedDB.exists && status.indexedDB.expiry && Date.now() > status.indexedDB.expiry) {
        console.log('🗑️ IndexedDB 캐시 만료됨, 정리 중...');
        await indexedDBCache.clearCache(userId);
        cleanedCount++;
      }

      // 분리된 캐시 정리
      if (status.separated.exists && status.separated.expiry && Date.now() > status.separated.expiry) {
        console.log('🗑️ 분리된 캐시 만료됨, 정리 중...');
        await separatedCache.clearSeparatedCache(userId);
        cleanedCount++;
      }

      if (cleanedCount > 0) {
        console.log(`✅ ${cleanedCount}개 만료된 캐시 정리 완료`);
      } else {
        console.log('✅ 만료된 캐시 없음');
      }
    } catch (error) {
      console.error('❌ 캐시 정리 실패:', error);
    }
  }

  // 모든 캐시 강제 정리
  async clearAllCaches(userId: string): Promise<void> {
    try {
      console.log('🗑️ 모든 캐시 강제 정리 시작...');
      
      await Promise.all([
        simpleCache.clearCache(userId),
        indexedDBCache.clearCache(userId),
        separatedCache.clearSeparatedCache(userId)
      ]);

      console.log('✅ 모든 캐시 정리 완료');
    } catch (error) {
      console.error('❌ 모든 캐시 정리 실패:', error);
    }
  }

  // 캐시 최적화 (가장 효율적인 캐시만 유지)
  async optimizeCaches(userId: string): Promise<void> {
    try {
      console.log('⚡ 캐시 최적화 시작...');
      
      const status = await this.getAllCacheStatus(userId);
      
      // IndexedDB가 가장 효율적이므로 우선 사용
      if (status.indexedDB.exists) {
        console.log('✅ IndexedDB 캐시 사용 (가장 효율적)');
        
        // localStorage 정리 (용량 절약)
        if (status.localStorage.exists) {
          console.log('🗑️ localStorage 캐시 정리 (용량 절약)');
          simpleCache.clearCache(userId);
        }
        
        return;
      }

      // IndexedDB가 없으면 localStorage 사용
      if (status.localStorage.exists) {
        console.log('✅ localStorage 캐시 사용');
        return;
      }

      console.log('⚠️ 사용 가능한 캐시 없음');
    } catch (error) {
      console.error('❌ 캐시 최적화 실패:', error);
    }
  }

  // 자동 정리 시작
  private startAutoCleanup(): void {
    setInterval(() => {
      // 현재 사용자 ID가 있다면 정리 실행
      const currentUserId = this.getCurrentUserId();
      if (currentUserId) {
        this.cleanupExpiredCaches(currentUserId);
      }
    }, this.CLEANUP_INTERVAL);

    console.log('🔄 자동 캐시 정리 시작 (24시간마다)');
  }

  // 현재 사용자 ID 가져오기 (간단한 구현)
  private getCurrentUserId(): string | null {
    // 실제 구현에서는 인증 시스템에서 가져와야 함
    try {
      const authData = localStorage.getItem('auth_user');
      if (authData) {
        const user = JSON.parse(authData);
        return user.uid || null;
      }
    } catch (error) {
      console.error('사용자 ID 가져오기 실패:', error);
    }
    return null;
  }

  // 바이트를 읽기 쉬운 형태로 변환
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
  }

  // 캐시 통계 출력
  async printCacheStats(userId: string): Promise<void> {
    try {
      const status = await this.getAllCacheStatus(userId);
      
      console.log('📊 캐시 상태 통계:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      Object.entries(status).forEach(([key, info]) => {
        const statusIcon = info.exists ? '✅' : '❌';
        const expiryText = info.expiry ? 
          new Date(info.expiry).toLocaleString('ko-KR') : 'N/A';
        
        console.log(`${statusIcon} ${key}:`);
        console.log(`   존재: ${info.exists ? '예' : '아니오'}`);
        console.log(`   데이터 수: ${info.count.toLocaleString()}개`);
        console.log(`   크기: ${info.size}`);
        console.log(`   마지막 업데이트: ${info.lastUpdated ? 
          new Date(info.lastUpdated).toLocaleString('ko-KR') : 'N/A'}`);
        console.log(`   만료 시간: ${expiryText}`);
        console.log('');
      });
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (error) {
      console.error('❌ 캐시 통계 출력 실패:', error);
    }
  }
}

export const cacheManager = new CacheManager();
