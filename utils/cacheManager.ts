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
  private readonly CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7일 - IndexedDB와 동일하게 설정
  private readonly CLEANUP_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7일마다 정리

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
      
      const status = await this.getAllCacheStatus(userId);
      let cleanedCount = 0;

      // localStorage 정리
      if (status.localStorage.exists && status.localStorage.expiry && Date.now() > status.localStorage.expiry) {
        simpleCache.clearCache();
        cleanedCount++;
      }

      // IndexedDB 정리
      if (status.indexedDB.exists && status.indexedDB.expiry && Date.now() > status.indexedDB.expiry) {
        await indexedDBCache.clearCache(userId);
        cleanedCount++;
      }

      // 분리된 캐시 정리
      if (status.separated.exists && status.separated.expiry && Date.now() > status.separated.expiry) {
        await separatedCache.clearSeparatedCache(userId);
        cleanedCount++;
      }

      if (cleanedCount > 0) {
      } else {
      }
    } catch (error) {
      console.error('❌ 캐시 정리 실패:', error);
    }
  }

  // 모든 캐시 강제 정리
  async clearAllCaches(userId: string): Promise<void> {
    try {
      
      await Promise.all([
        simpleCache.clearCache(),
        indexedDBCache.clearCache(userId),
        separatedCache.clearSeparatedCache(userId)
      ]);

    } catch (error) {
      console.error('❌ 모든 캐시 정리 실패:', error);
    }
  }

  // 캐시 최적화 (가장 효율적인 캐시만 유지)
  async optimizeCaches(userId: string): Promise<void> {
    try {
      
      const status = await this.getAllCacheStatus(userId);
      
      // IndexedDB가 가장 효율적이므로 우선 사용
      if (status.indexedDB.exists) {
        
        // localStorage 정리 (용량 절약)
        if (status.localStorage.exists) {
          simpleCache.clearCache();
        }
        
        return;
      }

      // IndexedDB가 없으면 localStorage 사용
      if (status.localStorage.exists) {
        return;
      }

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
      
      
      Object.entries(status).forEach(([key, info]) => {
        const statusIcon = info.exists ? '✅' : '❌';
        const expiryText = info.expiry ? 
          new Date(info.expiry).toLocaleString('ko-KR') : 'N/A';
        
      });
      
    } catch (error) {
      console.error('❌ 캐시 통계 출력 실패:', error);
    }
  }
}

export const cacheManager = new CacheManager();
