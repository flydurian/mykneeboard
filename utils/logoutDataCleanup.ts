/**
 * 로그아웃 시 모든 사용자 데이터를 삭제하는 유틸리티 함수들
 */

import { indexedDBCache } from './indexedDBCache';

// localStorage에서 사용자 관련 데이터 키들
const USER_DATA_KEYS = [
  // 인증 관련
  'offline_auth_data',
  'offline_user_data',
  
  // 비행 데이터 캐시
  'flight_dashboard_cache_metadata',
  'internationalFlights',
  'domesticFlights',
  'lastGoogleSheetsSync',
  
  // 날씨 데이터 캐시 (동적으로 생성되는 키들)
  // weather_*, forecast_*, metar_*, taf_*, exchange_*
  
  // 계산기 상태
  'pilotRestCalculatorState',
  
  // 경고 해제 상태
  'passport_visa_warning_dismissed',
  
  // 동기화 큐
  'sync_queue',
  
  // 캐시 관련
  'auth_user'
];

/**
 * localStorage에서 사용자 관련 데이터를 모두 삭제합니다.
 * 테마 설정은 유지됩니다.
 */
export const clearUserLocalStorageData = (): void => {
  try {
    // 테마 설정 백업
    const theme = localStorage.getItem('theme');
    
    // 모든 localStorage 데이터 삭제
    localStorage.clear();
    
    // 테마 설정 복원
    if (theme) {
      localStorage.setItem('theme', theme);
    }
    
  } catch (error) {
    console.error('❌ localStorage 데이터 삭제 실패:', error);
  }
};

/**
 * IndexedDB의 모든 사용자 관련 데이터베이스를 삭제합니다.
 */
export const clearUserIndexedDBData = async (): Promise<void> => {
  try {
    if ('indexedDB' in window) {
      const databases = [
        'flightCache',
        'separatedCache', 
        'simpleCache',
        'FlightDashboardCache' // indexedDBCache에서 사용하는 데이터베이스명
      ];
      
      for (const dbName of databases) {
        try {
          await new Promise<void>((resolve, reject) => {
            const deleteReq = indexedDB.deleteDatabase(dbName);
            
            deleteReq.onsuccess = () => {
              resolve();
            };
            
            deleteReq.onerror = () => {
              console.warn(`⚠️ IndexedDB 데이터베이스 삭제 실패: ${dbName}`, deleteReq.error);
              resolve(); // 하나 실패해도 계속 진행
            };
            
            deleteReq.onblocked = () => {
              console.warn(`⚠️ IndexedDB 데이터베이스 삭제 차단됨: ${dbName}`);
              resolve(); // 차단되어도 계속 진행
            };
          });
        } catch (error) {
          console.warn(`⚠️ IndexedDB 데이터베이스 ${dbName} 삭제 중 오류:`, error);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ IndexedDB 데이터 삭제 실패:', error);
  }
};

/**
 * 캐시 매니저를 통해 모든 캐시 데이터를 삭제합니다.
 */
export const clearUserCacheData = async (userId?: string): Promise<void> => {
  try {
    // indexedDBCache의 clearCache 메서드 사용
    if (userId) {
      await indexedDBCache.clearCache(userId);
    }
    
    // simpleCache의 clearCache 메서드 사용 (userId가 없어도 동작)
    try {
      const { simpleCache } = await import('./simpleCache');
      simpleCache.clearCache();
    } catch (error) {
      console.warn('⚠️ SimpleCache 삭제 실패:', error);
    }
    
  } catch (error) {
    console.error('❌ 캐시 데이터 삭제 실패:', error);
  }
};

/**
 * Service Worker 캐시와 브라우저 캐시를 삭제합니다.
 */
export const clearBrowserCache = async (): Promise<void> => {
  try {
    // Service Worker 캐시 삭제
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }
    
    // Service Worker 등록 해제
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(registration => registration.unregister())
      );
    }
    
  } catch (error) {
    console.error('❌ 브라우저 캐시 삭제 실패:', error);
  }
};

/**
 * sessionStorage 데이터를 삭제합니다.
 */
export const clearSessionStorageData = (): void => {
  try {
    sessionStorage.clear();
  } catch (error) {
    console.error('❌ sessionStorage 데이터 삭제 실패:', error);
  }
};

/**
 * Cookie 데이터를 삭제합니다.
 */
export const clearCookieData = (): void => {
  try {
    // 현재 도메인의 모든 쿠키 삭제
    document.cookie.split(";").forEach((cookie) => {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      
      // 쿠키 삭제 (과거 날짜로 설정)
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`;
    });
  } catch (error) {
    console.error('❌ Cookie 데이터 삭제 실패:', error);
  }
};

/**
 * WebSQL 데이터베이스를 삭제합니다 (구형 브라우저 지원).
 */
export const clearWebSQLData = (): void => {
  try {
    if ('openDatabase' in window) {
      // WebSQL은 구형 브라우저에서만 지원되므로 try-catch로 안전하게 처리
      const db = (window as any).openDatabase('', '', '', '');
      if (db) {
        db.transaction((tx: any) => {
          tx.executeSql('DROP DATABASE IF EXISTS flight_dashboard');
        });
      }
    }
  } catch (error) {
    // WebSQL이 지원되지 않는 경우 무시
  }
};

/**
 * Application Cache를 삭제합니다 (구형 브라우저 지원).
 */
export const clearApplicationCache = (): void => {
  try {
    if ('applicationCache' in window) {
      const appCache = (window as any).applicationCache;
      if (appCache) {
        appCache.update();
        appCache.swapCache();
      }
    }
  } catch (error) {
    // Application Cache가 지원되지 않는 경우 무시
  }
};

/**
 * 모든 사용자 데이터를 삭제합니다.
 * 로그아웃 시 호출되는 메인 함수입니다.
 */
export const clearAllUserData = async (userId?: string): Promise<void> => {
  try {
    // 1. localStorage 데이터 삭제 (테마 제외)
    clearUserLocalStorageData();
    
    // 2. sessionStorage 데이터 삭제
    clearSessionStorageData();
    
    // 3. Cookie 데이터 삭제
    clearCookieData();
    
    // 4. IndexedDB 데이터베이스 삭제
    await clearUserIndexedDBData();
    
    // 5. 캐시 데이터 삭제
    await clearUserCacheData(userId);
    
    // 6. 브라우저 캐시 및 Service Worker 삭제
    await clearBrowserCache();
    
    // 7. WebSQL 데이터 삭제 (구형 브라우저 지원)
    clearWebSQLData();
    
    // 8. Application Cache 삭제 (구형 브라우저 지원)
    clearApplicationCache();
    
  } catch (error) {
    console.error('❌ 사용자 데이터 삭제 중 오류:', error);
  }
};

/**
 * 특정 사용자의 데이터만 삭제하는 함수 (다중 사용자 지원)
 */
export const clearSpecificUserData = async (userId: string): Promise<void> => {
  try {
    // IndexedDB에서 특정 사용자 데이터만 삭제
    await indexedDBCache.clearCache(userId);
    
    // localStorage는 사용자별로 구분되지 않으므로 전체 삭제
    clearUserLocalStorageData();
  } catch (error) {
    console.error(`❌ 사용자 ${userId}의 데이터 삭제 중 오류:`, error);
  }
};
