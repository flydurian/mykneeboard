import { ref, get, set, push, update, remove, onValue, off, goOffline, goOnline } from "firebase/database";
import { database, auth } from "./config";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  encryptDocumentExpiryDates,
  decryptDocumentExpiryDates,
  upgradeDocumentExpiryDates,
  encryptCrewMemos,
  decryptCrewMemos,
  upgradeCrewMemos,
  encryptCityMemos,
  decryptCityMemos,
  upgradeCityMemos,
  upgradeUserSettings,
  decryptData,
  isValidDateFormat,
  encryptUserSettings,
  decryptUserSettings
} from "../../utils/encryption";
import { indexedDBCache } from "../../utils/indexedDBCache";

// 마이그레이션 완료 추적을 위한 상수 및 헬퍼 함수
const MIGRATION_STEPS = ['cityMemos', 'crewMemos', 'documentExpiryDates', 'userSettings'];

/**
 * 마이그레이션 단계별 완료를 기록하고 모든 단계 완료 시 이전 UID를 삭제합니다.
 */
const markMigrationStepComplete = (userId: string, step: string) => {
  const oldUid = localStorage.getItem('migration_old_uid');
  if (!oldUid) return;

  try {
    const statusKey = `migration_status_${userId}`;
    const completedStr = localStorage.getItem(statusKey);
    let completed: string[] = [];
    try {
      completed = completedStr ? JSON.parse(completedStr) : [];
    } catch (e) {
      completed = [];
    }

    if (!Array.isArray(completed)) completed = [];

    if (!completed.includes(step)) {
      completed.push(step);
      localStorage.setItem(statusKey, JSON.stringify(completed));
      // console.log(`✅ 마이그레이션 단계 완료: ${step} (${completed.length}/${MIGRATION_STEPS.length})`);
    }

    // 모든 필수 노드가 업그레이드(또는 확인) 되었는지 검사
    if (MIGRATION_STEPS.every(s => completed.includes(s))) {
      // console.log('🎉 모든 데이터 마이그레이션 및 업그레이드 확인됨. 임시 이전 UID 정보를 삭제합니다.');
      localStorage.removeItem('migration_old_uid');
      localStorage.removeItem(statusKey);
    }
  } catch (err) {
    console.warn('⚠️ 마이그레이션 상태 기록 오류:', err);
  }
};

// 오프라인 상태 관리
let isOfflineMode = false;

// Firebase 연결 상태 관리
export const setFirebaseOfflineMode = (offline: boolean) => {
  console.log(`📡 setFirebaseOfflineMode 호출됨: ${offline}`);
  isOfflineMode = offline;

  if (database) {
    if (offline) {
      goOffline(database);
    } else {
      goOnline(database);
    }
  }
};

// 오프라인 상태 확인
const isFirebaseOffline = (): boolean => {
  return isOfflineMode || !navigator.onLine;
};

// 기존 방식 복호화 함수 (호환성용)
const decryptDataLegacy = (encryptedData: string): string => {
  try {
    const possibleKeys = [
      'quantummechanics2024',
      'astrophysics',
      'neuroscience123',
      ''
    ];

    for (const keyBase of possibleKeys) {
      try {
        const key = btoa(keyBase).slice(0, 16);
        const decoded = decodeURIComponent(escape(atob(encryptedData)));
        const dataWithKey = decoded;
        const data = dataWithKey.slice(0, -key.length);
        const result = decodeURIComponent(escape(atob(data)));

        if (isValidDateFormat(result)) {
          return result;
        }
      } catch (e) {
        continue;
      }
    }

    try {
      const directDecode = atob(encryptedData);
      if (isValidDateFormat(directDecode)) {
        return directDecode;
      }
    } catch (e) {
      // 직접 디코딩도 실패
    }

    return encryptedData;
  } catch (error) {
    console.error('기존 방식 복호화 오류:', error);
    return encryptedData;
  }
};


// 네트워크 오류 감지 함수
const isNetworkError = (error: any): boolean => {
  const errorMessage = error?.message || '';
  const errorCode = error?.code || '';

  return (
    errorMessage.includes('net::ERR_INTERNET_DISCONNECTED') ||
    errorMessage.includes('net::ERR_NETWORK_CHANGED') ||
    errorMessage.includes('net::ERR_NAME_NOT_RESOLVED') ||
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('Network request failed') ||
    errorCode === 'unavailable' ||
    errorCode === 'network-request-failed'
  );
};

// 안전한 숫자 변환 함수 (NaN 방지)
const safeParseInt = (value: string): number => {
  // 숫자로만 구성된 문자열인지 확인
  if (/^\d+$/.test(value)) {
    return parseInt(value);
  }

  // 숫자가 아닌 경우 해시 기반 숫자 생성
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32비트 정수로 변환
  }
  return Math.abs(hash);
};

// 기본 데이터 읽기 함수
const readData = async (path: string) => {
  try {
    const dataRef = ref(database, path);
    const snapshot = await get(dataRef);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    if (isNetworkError(error)) {
      return null;
    }
    console.error(`Error reading data from ${path}:`, error);
    return null;
  }
};

// 기본 데이터 쓰기 함수
const writeData = async (path: string, data: any) => {
  try {
    const dataRef = ref(database, path);
    await set(dataRef, data);
    return true;
  } catch (error) {
    if (isNetworkError(error)) {
      return false;
    }
    console.error(`Error writing data to ${path}:`, error);
    return false;
  }
};

// 기본 데이터 푸시 함수
const pushData = async (path: string, data: any) => {
  try {
    const dataRef = ref(database, path);
    const newRef = await push(dataRef, data);
    return newRef.key;
  } catch (error) {
    if (isNetworkError(error)) {
      return null;
    }
    console.error(`Error pushing data to ${path}:`, error);
    return null;
  }
};

// 기본 데이터 업데이트 함수
const updateData = async (path: string, data: any) => {
  try {
    const dataRef = ref(database, path);
    await update(dataRef, data);
    return true;
  } catch (error) {
    if (isNetworkError(error)) {
      return false;
    }
    console.error(`Error updating data at ${path}:`, error);
    return false;
  }
};

// 기본 데이터 삭제 함수
const deleteData = async (path: string) => {
  try {
    const dataRef = ref(database, path);

    // 삭제 전 데이터 확인
    const snapshot = await get(dataRef);

    if (!snapshot.exists()) {
      return false;
    }

    await remove(dataRef);

    return true;
  } catch (error) {
    if (isNetworkError(error)) {
      return false;
    }
    console.error(`Error deleting data at ${path}:`, error);
    console.error('🗑️ deleteData 오류 상세:', error);
    return false;
  }
};

// 기본 데이터 구독 함수
const subscribeToData = (path: string, callback: (data: any) => void) => {
  const dataRef = ref(database, path);
  onValue(dataRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    } else {
      callback(null);
    }
  }, (error) => {
    if (isNetworkError(error)) {
      return;
    }
    console.error(`Error subscribing to ${path}:`, error);
  });

  return () => off(dataRef);
};

// 사용자별 월별 데이터 경로 생성 함수
const getMonthPath = (date: string, userId: string) => {
  const dateObj = new Date(date);
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1; // 0-based to 1-based
  const path = `users/${userId}/flights/${year}/${month}`;
  return path;
};

// 알림 인덱스 경로 생성 (yyyy-MM-dd)
const getAlarmIndexPath = (date: string, userId: string, flightId: string) => {
  return `schedules/${date}/${userId}/${flightId}`;
};

// 알림용 경량 데이터 생성
const createAlarmData = (flightData: any) => {
  return {
    flightId: flightData.id || 0,
    flightNumber: flightData.flightNumber || '',
    showUpDateTimeUtc: flightData.showUpDateTimeUtc || null,
    departureDateTimeUtc: flightData.departureDateTimeUtc || null,
    // 필요한 데이터만 최소한으로 저장
  };
};

// -----------------------------
// Crew 저장 형식 변환 유틸리티
// -----------------------------

// 배열을 {"0": item0, "1": item1, ...} 객체로 변환 (Firebase에 안전하게 저장)
const arrayToIndexedObject = (arr: any[] | undefined | null): { [key: string]: any } | undefined => {
  if (!arr) return undefined;
  if (Array.isArray(arr)) {
    const obj: { [key: string]: any } = {};
    arr.forEach((item, idx) => {
      if (item !== undefined) obj[String(idx)] = item;
    });
    return obj;
  }
  if (typeof arr === 'object') return arr as any;
  return undefined;
};

// {"0": item0, "1": item1, ...} 객체를 배열로 복원
const indexedObjectToArray = (obj: any): any[] => {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  if (typeof obj === 'object') {
    return Object.keys(obj)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(k => obj[k]);
  }
  return [];
};

// crew 배열/객체를 인덱스 객체로 변환하면서 'posn type' 호환 키도 함께 저장
const toIndexedCrewObjectForWrite = (value: any[] | { [k: string]: any } | undefined | null) => {
  const obj = arrayToIndexedObject(value as any[]);
  if (!obj) return obj;
  const result: { [k: string]: any } = {};
  Object.keys(obj).forEach(k => {
    const member = obj[k] || {};
    // 기존 필드 보존 + 호환 키 추가
    result[k] = {
      ...member,
      // Firebase에서 가시성 요구에 따라 공백 포함 키도 함께 저장
      ['posn type']: member.posnType !== undefined ? member.posnType : member['posn type']
    };
  });
  return result;
};

// Flight 데이터를 쓰기 전에 crew/cabinCrew를 인덱스 객체로 변환
const transformCrewFieldsForWrite = (flightData: any) => {
  const copy = { ...flightData };
  if (copy.crew !== undefined) {
    copy.crew = toIndexedCrewObjectForWrite(copy.crew);
  }
  if (copy.cabinCrew !== undefined) {
    // cabinCrew는 호환 키가 필요 없지만 형식은 동일하게 맞춤
    copy.cabinCrew = arrayToIndexedObject(copy.cabinCrew as any[]);
  }
  return copy;
};

// Flight 데이터를 읽을 때 crew/cabinCrew를 배열로 복원
const transformCrewFieldsForRead = (flightData: any) => {
  const copy = { ...flightData };
  // 객체 → 배열 복원
  const crewArray = indexedObjectToArray(copy.crew);
  // 호환 키('posn type')가 존재하면 posnType에 병합
  copy.crew = crewArray.map((m: any) => ({
    ...m,
    posnType: m?.posnType !== undefined ? m.posnType : m?.['posn type']
  }));
  copy.cabinCrew = indexedObjectToArray(copy.cabinCrew);
  return copy;
};



// 사용자의 모든 월의 비행 데이터 가져오기
export const getAllFlights = async (userId: string) => {
  try {
    // 오프라인 상태 체크
    if (isFirebaseOffline()) {
      console.log('⚠️ getAllFlights: 오프라인 모드 - 캐시된 데이터 사용');
      const cachedFlights = await indexedDBCache.loadFlights(userId);
      if (cachedFlights && cachedFlights.length > 0) {
        return cachedFlights;
      }
    }

    if (!userId) {
      console.log('❌ getAllFlights: userId가 없음');
      return [];
    }

    // console.log(`🔍 getAllFlights 호출됨: userId=${userId}`);

    // 현재 인증 상태 확인 (디버깅용)
    const currentUser = auth.currentUser;

    // 🔧 인증 상태 불일치 문제 해결: 전달받은 userId 사용
    // auth.currentUser가 없더라도 userId가 있으면 시도 (보안 규칙이 처리)
    const actualUserId = userId;

    const allFlightsRef = ref(database, `users/${actualUserId}/flights`);

    // 🔧 간단한 연결 테스트: 실제 데이터 경로로 직접 시도
    try {
      const snapshot = await get(allFlightsRef);

      if (!snapshot.exists()) {
        return [];
      }

      const allFlights: any[] = [];
      const yearData = snapshot.val();

      // 모든 연도와 월을 순회 (안전한 구조 검증 추가)
      Object.keys(yearData).forEach(year => {
        if (yearData[year] && typeof yearData[year] === 'object') {
          Object.keys(yearData[year]).forEach(month => {
            const monthFlights = yearData[year][month];
            if (monthFlights && typeof monthFlights === 'object') {
              Object.keys(monthFlights).forEach(flightKey => {
                let flightData = monthFlights[flightKey];
                if (flightData && typeof flightData === 'object') {
                  // crew/cabinCrew 배열 복원
                  flightData = transformCrewFieldsForRead(flightData);
                  // id 필드가 없거나 유효하지 않은 경우 안전한 숫자 변환 사용
                  const flightId = flightData.id && typeof flightData.id === 'number' && !isNaN(flightData.id) && flightData.id > 0
                    ? flightData.id
                    : safeParseInt(flightKey);

                  allFlights.push({
                    ...flightData,
                    id: flightId,
                    // status 필드가 없거나 불완전한 경우 초기화
                    status: {
                      departed: flightData.status?.departed || false,
                      landed: flightData.status?.landed || false,
                      ...flightData.status
                    },
                    // 실제 저장 경로 정보 추가
                    _storagePath: {
                      year: year,
                      month: month,
                      firebaseKey: flightKey
                    }
                  });
                }
              });
            }
          });
        }
      });

      // 총 비행 데이터 로드 완료 - 날짜와 출발시간 기준으로 정렬
      const sortedFlights = allFlights.sort((a, b) => {
        // 먼저 날짜로 정렬
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();

        if (dateA !== dateB) {
          return dateA - dateB;
        }

        // 같은 날짜인 경우 출발시간으로 정렬
        if (a.departureDateTimeUtc && b.departureDateTimeUtc) {
          return new Date(a.departureDateTimeUtc).getTime() - new Date(b.departureDateTimeUtc).getTime();
        }

        // 출발시간이 없는 경우 STD로 정렬
        if (a.std && b.std) {
          return a.std.localeCompare(b.std);
        }

        return 0;
      });

      // 💾 IndexedDB 캐시 업데이트
      if (sortedFlights.length > 0) {
        try {
          await indexedDBCache.saveFlights(sortedFlights, userId);
          console.log(`✅ IndexedDB 캐시 업데이트 완료: ${sortedFlights.length}개 비행`);
        } catch (cacheError) {
          console.warn('⚠️ IndexedDB 캐시 업데이트 실패:', cacheError);
        }
      }

      return sortedFlights;

    } catch (dbError) {
      console.error('❌ Firebase 데이터베이스 읽기 오류:', dbError);

      // 오프라인이거나 네트워크 오류 시 IndexedDB 캐시 로드 시도
      try {
        const cachedFlights = await indexedDBCache.loadFlights(userId);
        if (cachedFlights && cachedFlights.length > 0) {
          console.log('✅ 네트워크 오류로 인한 IndexedDB 캐시 사용 성공');
          return cachedFlights;
        }
      } catch (cacheError) {
        console.error('❌ 캐시 로드 실패:', cacheError);
      }

      // 권한 오류인 경우 빈 배열 반환
      if (dbError.code === 'PERMISSION_DENIED') {
        console.error('❌ 권한 거부됨: 데이터베이스 규칙을 확인하세요.');
        return [];
      }

      // 기타 오류는 상위로 전파
      throw dbError;
    }

  } catch (error) {
    console.error('❌ getAllFlights 오류:', error);
    console.error('🔍 오류 상세 정보:', {
      code: error.code,
      message: error.message,
      userId: userId,
      stack: error.stack
    });

    // 권한 오류인 경우 빈 배열 반환
    if (error.code === 'PERMISSION_DENIED') {
      return [];
    }

    throw error;
  }
};

// 사용자의 특정 월의 비행 데이터 가져오기
export const getFlightsByMonth = async (year: number, month: number, userId: string) => {
  const monthPath = `users/${userId}/flights/${year}/${month}`;
  const monthFlightsData = await readData(monthPath);

  if (!monthFlightsData) {
    return []; // 데이터가 없으면 빈 배열 반환
  }

  // Firebase 객체를 배열로 변환하면서 각 항목에 ID 부여 (안전한 구조 검증 추가)
  const monthFlightsArray: any[] = Object.keys(monthFlightsData).map(flightKey => {
    let flightData = monthFlightsData[flightKey];
    if (flightData && typeof flightData === 'object') {
      // crew/cabinCrew 배열 복원
      flightData = transformCrewFieldsForRead(flightData);
      const flightId = flightData.id && typeof flightData.id === 'number' && !isNaN(flightData.id) && flightData.id > 0
        ? flightData.id
        : safeParseInt(flightKey);

      // 비행 데이터 읽어옴

      return {
        ...flightData,
        id: flightId
      };
    }
    return null;
  }).filter(Boolean); // null 값 제거

  return monthFlightsArray;
};

// 비행 데이터 추가 (사용자별 월별로 자동 분류)
export const addFlight = async (flightData: any, userId: string) => {
  // undefined 값 제거 (Firebase에서 undefined 허용하지 않음)
  const cleanedFlightData = Object.keys(flightData).reduce((acc, key) => {
    if (flightData[key] !== undefined) {
      // null 값도 허용하되, 빈 문자열은 undefined로 처리
      if (flightData[key] === '' && key === 'regNo') {
        acc[key] = null; // regNo가 빈 문자열이면 null로 저장
      } else {
        acc[key] = flightData[key];
      }
    }
    return acc;
  }, {} as any);

  // crew/cabinCrew를 인덱스 객체로 변환하여 저장
  const dataForWrite = transformCrewFieldsForWrite(cleanedFlightData);



  const monthPath = getMonthPath(flightData.date, userId);
  const newKey = await pushData(monthPath, dataForWrite);

  // 생성된 키를 id 필드로 저장 (안전한 숫자 변환 사용)
  if (newKey) {
    const flightRef = ref(database, `${monthPath}/${newKey}`);
    const safeId = safeParseInt(newKey);
    await update(flightRef, { id: safeId });

    // 🔧 알림 인덱스 저장 (Show Up 시간이 있는 경우에만)
    if (flightData.showUpDateTimeUtc) {
      try {
        const alarmPath = getAlarmIndexPath(flightData.date, userId, String(safeId));
        await set(ref(database, alarmPath), createAlarmData({ ...flightData, id: safeId }));
      } catch (e) {
        console.warn('알림 인덱스 저장 실패:', e);
      }
    }
  }

  // 💾 IndexedDB 캐시 업데이트 (단일 항목 추가)
  try {
    if (newKey) {
      const flightWithId = { ...cleanedFlightData, id: safeParseInt(newKey) };
      await indexedDBCache.updateFlightData(flightWithId);
    }
  } catch (e) {
    console.warn('⚠️ IndexedDB 캐시 업데이트 실패 (addFlight):', e);
  }

  return newKey;
};

// 비행 데이터 업데이트 (이륙/착륙 상태만)
export const updateFlight = async (flightId: number, dataToUpdate: any, userId: string) => {
  // 모든 월에서 해당 비행을 찾아서 업데이트
  const allFlightsRef = ref(database, `users/${userId}/flights`);
  const snapshot = await get(allFlightsRef);

  if (snapshot.exists()) {
    const yearData = snapshot.val();
    let found = false;

    for (const year of Object.keys(yearData)) {
      if (yearData[year] && typeof yearData[year] === 'object') {
        for (const month of Object.keys(yearData[year])) {
          const monthFlights = yearData[year][month];
          if (monthFlights && typeof monthFlights === 'object') {
            // Firebase 키로 순회하면서 ID 필드로 매칭
            for (const firebaseKey of Object.keys(monthFlights)) {
              const existingFlightData = monthFlights[firebaseKey];
              if (existingFlightData && typeof existingFlightData === 'object') {
                const flightIdNum = existingFlightData.id && typeof existingFlightData.id === 'number' && !isNaN(existingFlightData.id) && existingFlightData.id > 0
                  ? existingFlightData.id
                  : safeParseInt(firebaseKey);

                // ID가 일치하는 항공편 찾기 (타입 불일치 해결을 위해 String() 변환 사용)
                if (String(flightIdNum) === String(flightId)) {
                  const flightRef = ref(database, `users/${userId}/flights/${year}/${month}/${firebaseKey}`);
                  await update(flightRef, dataToUpdate);

                  // 🔧 알림 인덱스 업데이트
                  // 날짜가 변경되었을 수 있으므로 기존 날짜 삭제 후 새 날짜 추가 필요
                  try {
                    const oldDate = existingFlightData.date;
                    const newDate = dataToUpdate.date || oldDate;

                    // 날짜가 바뀌었거나 ShowUp 시간이 바뀐 경우
                    if (oldDate !== newDate || dataToUpdate.showUpDateTimeUtc !== undefined) {
                      // 기존 인덱스 삭제
                      await remove(ref(database, getAlarmIndexPath(oldDate, userId, String(flightId))));

                      // 새 인덱스 추가 (Show Up 시간이 존재하는 경우)
                      const mergedData = { ...existingFlightData, ...dataToUpdate };
                      if (mergedData.showUpDateTimeUtc) {
                        await set(ref(database, getAlarmIndexPath(newDate, userId, String(flightId))), createAlarmData(mergedData));
                      }
                    } else if (dataToUpdate.showUpDateTimeUtc) {
                      // 날짜는 같고 내용만 업데이트
                      await update(ref(database, getAlarmIndexPath(oldDate, userId, String(flightId))), createAlarmData({ ...existingFlightData, ...dataToUpdate }));
                    }
                  } catch (e) {
                    console.warn('알림 인덱스 업데이트 실패:', e);
                  }

                  found = true;

                  // 💾 IndexedDB 캐시 업데이트 (이륙/착륙 상태 등)
                  try {
                    await indexedDBCache.updateFlight(flightId, dataToUpdate, userId);
                  } catch (e) {
                    console.warn('⚠️ IndexedDB 캐시 업데이트 실패 (updateFlight):', e);
                  }

                  break;
                }
              }
            }
          }
          if (found) break;
        }
        if (found) break;
      }
    }

    if (!found) {
      console.error(`항공편을 찾을 수 없음: ID=${flightId}`);
      throw new Error(`항공편을 찾을 수 없습니다: ${flightId}`);
    }
  }
};

// 비행 데이터 삭제 (실제 저장 경로 사용)
export const deleteFlight = async (flightId: string, storagePath: { year: string, month: string, firebaseKey: string }, userId: string) => {
  const fullPath = `users/${userId}/flights/${storagePath.year}/${storagePath.month}/${storagePath.firebaseKey}`;

  // 실제 데이터 존재 여부 확인 및 알림 인덱스 삭제를 위한 데이터 확보
  let flightDate = '';
  let validFlightId = '';

  try {
    const dataRef = ref(database, fullPath);
    const snapshot = await get(dataRef);
    if (!snapshot.exists()) {
      return false;
    }
    const val = snapshot.val();
    flightDate = val.date;
    validFlightId = val.id ? String(val.id) : safeParseInt(storagePath.firebaseKey).toString();
  } catch (error) {
    console.error('🗑️ 데이터 존재 확인 중 오류:', error);
    return false;
  }

  const result = await deleteData(fullPath);

  // 🔧 알림 인덱스 삭제 및 💾 IndexedDB 캐시 업데이트
  if (result) {
    try {
      if (flightDate && validFlightId) {
        await remove(ref(database, getAlarmIndexPath(flightDate, userId, validFlightId)));
      }
      await indexedDBCache.deleteFlight(Number(validFlightId));
    } catch (e) {
      console.warn('⚠️ 후속 작업 실패 (deleteFlight):', e);
    }
  }

  return result;
};

// 🔑 기존 데이터 마이그레이션: 모든 유효한 비행에 대해 알림 인덱스 생성
export const syncAlarmIndexes = async (userId: string) => {
  try {
    console.log('🔄 알림 인덱스 동기화 시작...');
    const allFlights = await getAllFlights(userId);

    if (!allFlights || allFlights.length === 0) {
      console.log('동기화할 비행 데이터 없음');
      return;
    }

    const promises: Promise<void>[] = [];
    let count = 0;

    allFlights.forEach(flight => {
      // Show Up 시간이 있고, 유효한 ID가 있는 경우
      if (flight.showUpDateTimeUtc && flight.date && flight.id) {
        const alarmPath = getAlarmIndexPath(flight.date, userId, String(flight.id));
        promises.push(set(ref(database, alarmPath), createAlarmData(flight)));
        count++;
      }
    });

    if (count > 0) {
      await Promise.all(promises);
      // console.log(`✅ ${count}개의 비행에 대한 알림 인덱스 생성 완료`);
    } else {
      console.log('업데이트할 알림 인덱스 없음');
    }
  } catch (error) {
    console.error('❌ 알림 인덱스 동기화 실패:', error);
  }
};

// 여러 비행 데이터 일괄 추가
export const addMultipleFlights = async (flights: any[], userId: string) => {
  try {


    const promises = flights.map(flight => addFlight(flight, userId));
    const results = await Promise.all(promises);
    return results;
  } catch (error) {
    console.error('Error adding multiple flights:', error);
    throw error;
  }
};

// 사용자의 모든 월의 실시간 구독
export const subscribeToAllFlights = (callback: (flights: any[]) => void, userId: string) => {
  // 오프라인 상태 체크
  if (isFirebaseOffline()) {
    return () => { }; // 빈 unsubscribe 함수 반환
  }

  const allFlightsRef = ref(database, `users/${userId}/flights`);
  onValue(allFlightsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }

    const allFlights: any[] = [];
    const yearData = snapshot.val();

    Object.keys(yearData).forEach(year => {
      if (yearData[year] && typeof yearData[year] === 'object') {
        Object.keys(yearData[year]).forEach(month => {
          const monthFlights = yearData[year][month];
          if (monthFlights && typeof monthFlights === 'object') {
            Object.keys(monthFlights).forEach(flightKey => {
              const flightData = monthFlights[flightKey];
              if (flightData && typeof flightData === 'object') {
                // id 필드가 없거나 유효하지 않은 경우 안전한 숫자 변환 사용
                const flightId = flightData.id && typeof flightData.id === 'number' && !isNaN(flightData.id) && flightData.id > 0
                  ? flightData.id
                  : safeParseInt(flightKey);

                allFlights.push({
                  ...flightData,
                  id: flightId,
                  // status 필드가 없거나 불완전한 경우 초기화
                  status: {
                    departed: flightData.status?.departed || false,
                    landed: flightData.status?.landed || false,
                    ...flightData.status
                  }
                });
              }
            });
          }
        });
      }
    });

    // 날짜와 출발시간 기준으로 정렬
    const sortedFlights = allFlights.sort((a, b) => {
      // 먼저 날짜로 정렬
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();

      if (dateA !== dateB) {
        return dateA - dateB;
      }

      // 같은 날짜인 경우 출발시간으로 정렬
      if (a.departureDateTimeUtc && b.departureDateTimeUtc) {
        return new Date(a.departureDateTimeUtc).getTime() - new Date(b.departureDateTimeUtc).getTime();
      }

      // 출발시간이 없는 경우 STD로 정렬
      if (a.std && b.std) {
        return a.std.localeCompare(b.std);
      }

      return 0;
    });
    callback(sortedFlights);
  });

  return () => off(allFlightsRef);
};

// 사용자의 특정 월의 실시간 구독
export const subscribeToFlightsByMonth = (year: number, month: number, callback: (flights: any) => void, userId: string) => {
  const monthPath = `users/${userId}/flights/${year}/${month.toString().padStart(2, '0')}`;
  return subscribeToData(monthPath, callback);
};

// 기존 함수들 (하위 호환성을 위해 유지)
export const getFlights = async (userId: string) => {
  return await getAllFlights(userId);
};

export const subscribeToFlights = (callback: (flights: any) => void, userId: string) => {
  return subscribeToAllFlights(callback, userId);
};

// 사용자 설정 정보 저장 (암호화 적용)
export const saveUserSettings = async (userId: string, settings: { airline?: string; selectedCurrencyCards?: string[]; empl?: string; userName?: string; base?: string; company?: string }) => {
  try {
    const settingsPath = `users/${userId}/settings`;

    // 기존 설정을 먼저 가져오기
    const existingSettings = await readData(settingsPath) || {};

    // 새로운 설정을 먼저 암호화
    const encryptedPatch = await encryptUserSettings(settings, userId);

    // 기존 설정과 새로운 설정을 병합 (암호화된 값은 덮어쓰기됨)
    const mergedSettings = {
      ...existingSettings,
      ...settings,
      ...encryptedPatch
    };

    // 저장
    const success = await writeData(settingsPath, mergedSettings);

    // IndexedDB에도 회사/베이스를 저장
    try {
      const company = mergedSettings.airline || mergedSettings.company;
      const base = mergedSettings.base;
      if (company || base) {
        await indexedDBCache.saveUserSettings(userId, { company, base });
      }
    } catch (e) {
      console.warn('⚠️ IndexedDB 사용자 설정 저장 경고:', e);
    }

    return success;
  } catch (error) {
    console.error('Error saving user settings:', error);
    return false;
  }
};

// 사용자 설정 정보 가져오기
export const getUserSettings = async (userId: string) => {
  try {
    // 오프라인이거나 Firebase 연결이 끊긴 경우 IndexedDB에서 먼저 시도
    if (isFirebaseOffline()) {
      const localSettings = await indexedDBCache.loadUserSettings(userId);
      if (localSettings) {
        return {
          airline: localSettings.company || 'OZ',
          base: localSettings.base ? String(localSettings.base).toUpperCase() : undefined
        };
      }
    }

    const settingsPath = `users/${userId}/settings`;
    const settings = await readData(settingsPath);

    if (!settings) {
      // 원격 데이터가 없으면 IndexedDB에서 다시 시도
      const localSettings = await indexedDBCache.loadUserSettings(userId);
      if (localSettings) {
        return {
          airline: localSettings.company || 'OZ',
          base: localSettings.base ? String(localSettings.base).toUpperCase() : undefined
        };
      }
      return { airline: 'OZ' }; // 기본값 설정
    }

    let dbSettings = settings;

    // [마이그레이션] 업그레이드 필요성 확인 및 자동 업그레이드
    if (!isFirebaseOffline()) {
      const oldUid = localStorage.getItem('migration_old_uid');

      // 암호화 대상 필드가 있는지 (Legacy든 New든 일단 존재하면)
      const hasEncryptedFields = settings.airline || settings.empl || settings.userName;

      if (hasEncryptedFields) {
        try {
          // upgradeUserSettings가 내부적으로 AES-GCM 복호화 및 재암호화를 수행 (결과는 AES-GCM 암호화된 상태)
          const upgradedSettings = await upgradeUserSettings(settings, userId, oldUid || undefined);

          // 변경사항이 있으면 DB에 직접 덮어쓰기 (saveUserSettings는 이중 암호화 되므로 writeData 직접 호출)
          if (JSON.stringify(upgradedSettings) !== JSON.stringify(settings)) {
            await writeData(settingsPath, upgradedSettings);
            dbSettings = upgradedSettings;
          }

          // 마이그레이션 단계 완료 표시
          markMigrationStepComplete(userId, 'userSettings');
        } catch (upgradeError) {
          console.error('사용자 설정 업그레이드 오류:', upgradeError);
        }
      }
    }

    // DB에서 가져온 (혹은 방금 업그레이드된) 설정을 앱 UI에서 사용할 수 있도록 평문(plaintext)으로 복호화합니다.
    const plaintextSettings = await decryptUserSettings(dbSettings, userId);

    let normalizedSettings = {
      ...dbSettings, // base 및 다른 비암호화 속성들 유지
      ...plaintextSettings, // 복호화된 이름, 항공사, 사번으로 오버라이드
      base: dbSettings.base ? String(dbSettings.base).toUpperCase() : dbSettings.base
    };

    // 최신 설정을 IndexedDB에 동기화 (오프라인 대비)
    try {
      const company = normalizedSettings.airline || normalizedSettings.company;
      const base = normalizedSettings.base;
      if (company || base) {
        await indexedDBCache.saveUserSettings(userId, { company, base });
      }
    } catch (e) {
      console.warn('⚠️ IndexedDB 사용자 설정 업데이트 경고:', e);
    }

    return normalizedSettings;
  } catch (error) {
    console.error('Error getting user settings:', error);

    // 오류 시 IndexedDB에서 최후로 시도
    try {
      const localSettings = await indexedDBCache.loadUserSettings(userId);
      if (localSettings) {
        return {
          airline: localSettings.company || 'OZ',
          base: localSettings.base ? String(localSettings.base).toUpperCase() : undefined
        };
      }
    } catch (e) {
      console.warn('⚠️ IndexedDB 사용자 설정 로드 실패:', e);
    }

    return { airline: 'OZ' }; // 오류 시 기본값 반환
  }
};

// 문서 만료일 저장 (AES-GCM 암호화)
export const saveDocumentExpiryDates = async (userId: string, expiryDates: { [key: string]: string }) => {
  try {
    const expiryDatesPath = `users/${userId}/documentExpiryDates`;

    // 데이터 암호화 (AES-GCM)
    const encryptedExpiryDates = await encryptDocumentExpiryDates(expiryDates, userId);

    // IndexedDB에 암호화된 상태로 저장 (오프라인 대응)
    await indexedDBCache.saveDocumentExpiryDates(encryptedExpiryDates, userId);

    // 오프라인 모드면 여기서 종료
    if (isFirebaseOffline()) {
      return true;
    }

    const success = await writeData(expiryDatesPath, encryptedExpiryDates);
    return success;
  } catch (error) {
    console.error('Error saving document expiry dates:', error);
    return false;
  }
};

// 문서 만료일 불러오기 (자동 업그레이드 포함)
export const getDocumentExpiryDates = async (userId: string) => {
  try {
    const expiryDatesPath = `users/${userId}/documentExpiryDates`;

    // ⚡ 오프라인 상태이면 즉시 캐시에서 로드
    if (isFirebaseOffline()) {
      const cachedDates = await indexedDBCache.loadDocumentExpiryDates(userId);
      if (Object.keys(cachedDates).length > 0) {
        console.log('📴 오프라인 모드: 문서 만료일 캐시 로드');
        const oldUid = localStorage.getItem('migration_old_uid');
        return await decryptDocumentExpiryDates(cachedDates, userId, oldUid || undefined);
      }
      return {};
    }
    let encryptedExpiryDates: { [key: string]: string } | null = null;

    // 오프라인 모드가 아니면 Firebase에서 시도
    if (!isFirebaseOffline()) {
      encryptedExpiryDates = await readData(expiryDatesPath);
    }

    // 데이터가 없으면 IndexedDB 캐시에서 확인
    if (!encryptedExpiryDates) {
      const cachedDates = await indexedDBCache.loadDocumentExpiryDates(userId);
      if (Object.keys(cachedDates).length > 0) {
        encryptedExpiryDates = cachedDates;
      } else {
        return {};
      }
    }

    // 데이터 복호화
    const oldUid = localStorage.getItem('migration_old_uid');
    const decryptedExpiryDates = await decryptDocumentExpiryDates(encryptedExpiryDates, userId, oldUid || undefined);

    // 업그레이드가 필요한지 확인 (기존 방식으로 복호화된 데이터가 있는지)
    if (!isFirebaseOffline()) {
      let needsUpgrade = false;
      if (encryptedExpiryDates) {
        for (const encryptedDate of Object.values(encryptedExpiryDates)) {
          if (!encryptedDate || typeof encryptedDate !== 'string') continue;
          try {
            const aesResult = await decryptData(encryptedDate, userId);
            if (!isValidDateFormat(aesResult)) {
              needsUpgrade = true;
              break;
            }
          } catch {
            needsUpgrade = true;
            break;
          }
        }
      }

      // 업그레이드가 필요한 경우에만 실행
      if (needsUpgrade) {
        try {
          // 모든 데이터를 새로운 방식으로 업그레이드
          const upgradedExpiryDates = await upgradeDocumentExpiryDates(encryptedExpiryDates, userId);

          // 업그레이드된 데이터를 Firebase에 저장
          await writeData(expiryDatesPath, upgradedExpiryDates);

          // IndexedDB에도 저장
          await indexedDBCache.saveDocumentExpiryDates(upgradedExpiryDates, userId);

          // 업그레이드된 데이터로 다시 복호화
          const upgradedDecryptedDates = await decryptDocumentExpiryDates(upgradedExpiryDates, userId);

          // 마이그레이션 단계 완료 표시
          markMigrationStepComplete(userId, 'documentExpiryDates');

          return upgradedDecryptedDates;
        } catch (upgradeError) {
          console.error('업그레이드 오류:', upgradeError);
          return decryptedExpiryDates;
        }
      } else {
        // 업그레이드가 필요 없는 경우 (이미 새 키로 암호화됨)
        if (encryptedExpiryDates && Object.keys(encryptedExpiryDates).length > 0) {
          markMigrationStepComplete(userId, 'documentExpiryDates');
        }
      }
    }

    // 읽은 데이터 캐시에 업데이트
    if (encryptedExpiryDates && !isFirebaseOffline()) {
      indexedDBCache.saveDocumentExpiryDates(encryptedExpiryDates, userId).catch(e =>
        console.warn('⚠️ 문서 만료일 캐시 업데이트 실패:', e)
      );
    }

    return decryptedExpiryDates;
  } catch (error) {
    console.error('Error getting document expiry dates:', error);
    try {
      const cachedDates = await indexedDBCache.loadDocumentExpiryDates(userId);
      if (Object.keys(cachedDates).length > 0) {
        const oldUid = localStorage.getItem('migration_old_uid');
        return await decryptDocumentExpiryDates(cachedDates, userId, oldUid || undefined);
      }
    } catch (cacheError) { }
    return {};
  }
};

// Crew 메모 저장
export const saveCrewMemos = async (userId: string, memos: { [key: string]: string }): Promise<void> => {
  try {

    // 메모 암호화
    const encryptedMemos = await encryptCrewMemos(memos, userId);

    // IndexedDB에 암호화된 상태로 저장 (오프라인 대응)
    await indexedDBCache.saveCrewMemos(encryptedMemos, userId);

    // 오프라인이면 Firebase 저장 스킵 (IndexedDB에만 저장)
    if (!isFirebaseOffline()) {
      const memosRef = ref(database, `users/${userId}/crewMemos`);
      await set(memosRef, encryptedMemos);
    } else {
      console.log('📴 오프라인 모드: Crew 메모 IndexedDB에만 저장');
    }

  } catch (error) {
    console.error('Error saving crew memos:', error);
    // Firebase 저장 실패해도 IndexedDB에는 저장되어 있음
  }
};

// Crew 메모 불러오기
export const getCrewMemos = async (userId: string): Promise<{ [key: string]: string }> => {
  try {
    // ⚡ 오프라인 상태이면 즉시 캐시에서 로드
    if (isFirebaseOffline()) {
      const cachedEncryptedMemos = await indexedDBCache.loadCrewMemos(userId);
      if (Object.keys(cachedEncryptedMemos).length > 0) {
        console.log('📴 오프라인 모드: Crew 메모 캐시 로드');
        const oldUid = localStorage.getItem('migration_old_uid');
        return await decryptCrewMemos(cachedEncryptedMemos, userId, oldUid || undefined);
      }
      return {};
    }

    const memosRef = ref(database, `users/${userId}/crewMemos`);
    // 3초 타임아웃 적용 (오프라인 시 무한 대기 방지)
    const snapshot = await Promise.race([
      get(memosRef),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firebase crew memos timeout')), 3000)
      )
    ]) as any;

    if (!snapshot.exists()) {
      // IndexedDB 캐시에서 확인
      const cachedEncryptedMemos = await indexedDBCache.loadCrewMemos(userId);
      if (Object.keys(cachedEncryptedMemos).length > 0) {
        // 암호화된 캐시 데이터 복호화
        const oldUid = localStorage.getItem('migration_old_uid');
        const decryptedMemos = await decryptCrewMemos(cachedEncryptedMemos, userId, oldUid || undefined);
        return decryptedMemos;
      }
      return {};
    }

    const encryptedMemos = snapshot.val() as { [key: string]: string };

    // 메모 복호화
    const oldUid = localStorage.getItem('migration_old_uid');
    const decryptedMemos = await decryptCrewMemos(encryptedMemos, userId, oldUid || undefined);

    // 업그레이드 필요성 확인 및 자동 업그레이드
    if (!isFirebaseOffline()) {
      let needsUpgrade = false;
      for (const encryptedMemo of Object.values(encryptedMemos)) {
        if (typeof encryptedMemo !== 'string') continue;
        try {
          const aesResult = await decryptData(encryptedMemo, userId);
          if (!aesResult || !aesResult.trim() || aesResult === encryptedMemo) {
            needsUpgrade = true;
            break;
          }
        } catch {
          needsUpgrade = true;
          break;
        }
      }

      // 업그레이드가 필요한 경우에만 실행
      if (needsUpgrade) {
        try {
          const upgradedMemos = await upgradeCrewMemos(encryptedMemos, userId);
          await set(memosRef, upgradedMemos);

          // IndexedDB 캐시에 암호화된 상태로 저장
          await indexedDBCache.saveCrewMemos(upgradedMemos, userId);

          // 업그레이드된 데이터로 다시 복호화
          const upgradedDecryptedMemos = await decryptCrewMemos(upgradedMemos, userId);

          // 마이그레이션 단계 완료 표시
          markMigrationStepComplete(userId, 'crewMemos');

          return upgradedDecryptedMemos;
        } catch (upgradeError) {
          console.error('Crew 메모 업그레이드 오류:', upgradeError);
          return decryptedMemos;
        }
      } else {
        // 업그레이드가 필요 없는 경우 (이미 새 키로 암호화됨)
        if (encryptedMemos && Object.keys(encryptedMemos).length > 0) {
          markMigrationStepComplete(userId, 'crewMemos');
        }
      }
    }

    // IndexedDB 캐시에 암호화된 상태로 저장
    await indexedDBCache.saveCrewMemos(encryptedMemos, userId);

    return decryptedMemos;
  } catch (error) {
    console.error('Error getting crew memos:', error);
    // 오프라인 상태일 때 IndexedDB 캐시에서 불러오기
    const cachedEncryptedMemos = await indexedDBCache.loadCrewMemos(userId);
    if (Object.keys(cachedEncryptedMemos).length > 0) {
      // 암호화된 캐시 데이터 복호화
      const oldUid = localStorage.getItem('migration_old_uid');
      const decryptedMemos = await decryptCrewMemos(cachedEncryptedMemos, userId, oldUid || undefined);
      return decryptedMemos;
    }
    return {};
  }
};

// 도시 메모 저장
export const saveCityMemos = async (userId: string, memos: { [key: string]: string }): Promise<void> => {
  try {

    // 메모 암호화
    const encryptedMemos = await encryptCityMemos(memos, userId);

    // IndexedDB에 암호화된 상태로 저장 (오프라인 대응)
    await indexedDBCache.saveCityMemos(encryptedMemos, userId);

    // 오프라인이면 Firebase 저장 스킵 (IndexedDB에만 저장)
    if (!isFirebaseOffline()) {
      const userRef = ref(database, `users/${userId}/cityMemos`);
      await set(userRef, encryptedMemos);
    } else {
      console.log('📴 오프라인 모드: 도시 메모 IndexedDB에만 저장');
    }

  } catch (error) {
    console.error('Error saving city memos:', error);
    // Firebase 저장 실패해도 IndexedDB에는 저장되어 있음
  }
};

// 도시 메모 불러오기
export const getCityMemos = async (userId: string): Promise<{ [key: string]: string }> => {
  try {
    // ⚡ 오프라인 상태이면 즉시 캐시에서 로드
    if (isFirebaseOffline()) {
      const cachedEncryptedMemos = await indexedDBCache.loadCityMemos(userId);
      if (Object.keys(cachedEncryptedMemos).length > 0) {
        console.log('📴 오프라인 모드: 도시 메모 캐시 로드');
        const oldUid = localStorage.getItem('migration_old_uid');
        return await decryptCityMemos(cachedEncryptedMemos, userId, oldUid || undefined);
      }
      return {};
    }

    const userRef = ref(database, `users/${userId}/cityMemos`);
    // 3초 타임아웃 적용 (오프라인 시 무한 대기 방지)
    const snapshot = await Promise.race([
      get(userRef),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firebase city memos timeout')), 3000)
      )
    ]) as any;

    if (!snapshot.exists()) {
      // IndexedDB 캐시에서 확인
      const cachedEncryptedMemos = await indexedDBCache.loadCityMemos(userId);
      if (Object.keys(cachedEncryptedMemos).length > 0) {
        // 암호화된 캐시 데이터 복호화
        const oldUid = localStorage.getItem('migration_old_uid');
        const decryptedMemos = await decryptCityMemos(cachedEncryptedMemos, userId, oldUid || undefined);
        return decryptedMemos;
      }
      return {};
    }

    const encryptedMemos = snapshot.val();
    const oldUid = localStorage.getItem('migration_old_uid');
    const decryptedMemos = await decryptCityMemos(encryptedMemos, userId, oldUid || undefined);

    // 업그레이드가 필요한지 확인 (레거시 데이터가 있는 경우)
    if (!isFirebaseOffline()) {
      let needsUpgrade = false;
      for (const encryptedMemo of Object.values(encryptedMemos)) {
        if (typeof encryptedMemo !== 'string') continue;
        try {
          const aesResult = await decryptData(encryptedMemo, userId);
          // AES-GCM으로 복호화된 결과가 올바른 문자열이 아니거나 원본과 같으면(복호화 안됨) 업그레이드 필요
          if (!aesResult || !aesResult.trim() || aesResult === encryptedMemo) {
            needsUpgrade = true;
            break;
          }
        } catch {
          needsUpgrade = true;
          break;
        }
      }

      // 업그레이드가 필요한 경우에만 실행
      if (needsUpgrade) {
        try {
          // 업그레이드 실행
          const upgradedMemos = await upgradeCityMemos(encryptedMemos, userId);

          // 업그레이드된 데이터를 Firebase에 저장
          await set(userRef, upgradedMemos);

          // IndexedDB 캐시에 암호화된 상태로 저장
          await indexedDBCache.saveCityMemos(upgradedMemos, userId);

          // 업그레이드된 데이터로 다시 복호화
          const oldUid = localStorage.getItem('migration_old_uid');
          const upgradedDecryptedMemos = await decryptCityMemos(upgradedMemos, userId, oldUid || undefined);

          // 마이그레이션 단계 완료 표시
          markMigrationStepComplete(userId, 'cityMemos');

          return upgradedDecryptedMemos;
        } catch (upgradeError) {
          console.error('도시 메모 업그레이드 오류:', upgradeError);
          return decryptedMemos;
        }
      } else {
        // 업그레이드가 필요 없는 경우 (이미 새 키로 암호화됨)
        if (encryptedMemos && Object.keys(encryptedMemos).length > 0) {
          markMigrationStepComplete(userId, 'cityMemos');
        }
      }
    }

    // IndexedDB 캐시에 암호화된 상태로 저장
    await indexedDBCache.saveCityMemos(encryptedMemos, userId);

    return decryptedMemos;
  } catch (error) {
    console.error('Error getting city memos:', error);
    // 오프라인 상태일 때 IndexedDB 캐시에서 불러오기
    const cachedEncryptedMemos = await indexedDBCache.loadCityMemos(userId);
    if (Object.keys(cachedEncryptedMemos).length > 0) {
      // 암호화된 캐시 데이터 복호화
      const oldUid = localStorage.getItem('migration_old_uid');
      const decryptedMemos = await decryptCityMemos(cachedEncryptedMemos, userId, oldUid || undefined);
      return decryptedMemos;
    }
    return {};
  }
};

// REST 정보 타입 정의
export interface RestInfo {
  activeTab: '2set' | '3pilot';
  twoSetMode: '1교대' | '2교대' | '5P';
  flightTime: string;
  flightTime5P: string;
  flightTime3Pilot: string;
  departureTime: string;
  crz1Time: string;
  crz1Time5P: string;
  afterTakeoff: string;
  afterTakeoff1교대: string;
  afterTakeoff5P: string;
  afterTakeoff3Pilot: string;
  afterTakeoff3PilotCase2?: string;
  beforeLanding: string;
  beforeLanding1교대: string;
  timeZone: string;
  threePilotCase: 'CASE1' | 'CASE2';
  lastUpdated: string;
}

// REST 정보 저장
export const saveRestInfo = async (userId: string, restInfo: RestInfo): Promise<void> => {
  try {
    if (isFirebaseOffline()) {
      // IndexedDB에만 저장
      await indexedDBCache.saveRestInfo(restInfo, userId);
      return;
    }

    // REST 정보에 타임스탬프 추가
    const restInfoWithTimestamp = {
      ...restInfo,
      lastUpdated: new Date().toISOString()
    };

    // IndexedDB에 저장 (오프라인 대응)
    await indexedDBCache.saveRestInfo(restInfoWithTimestamp, userId);

    // Firebase에 저장
    const userRef = ref(database, `users/${userId}/restInfo`);
    await set(userRef, restInfoWithTimestamp);

  } catch (error) {
    console.error('Error saving REST info:', error);
    // Firebase 저장 실패해도 IndexedDB에는 저장되어 있음
  }
};

// REST 정보 불러오기
export const getRestInfo = async (userId: string): Promise<RestInfo | null> => {
  try {
    if (isFirebaseOffline()) {
      return await indexedDBCache.loadRestInfo(userId);
    }

    const userRef = ref(database, `users/${userId}/restInfo`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      // IndexedDB 캐시에서 확인
      const cachedRestInfo = await indexedDBCache.loadRestInfo(userId);
      return cachedRestInfo;
    }

    const restInfo = snapshot.val();

    // IndexedDB 캐시에 저장
    await indexedDBCache.saveRestInfo(restInfo, userId);

    return restInfo;
  } catch (error) {
    console.error('Error getting REST info:', error);
    // 오프라인 상태일 때 IndexedDB 캐시에서 불러오기
    return await indexedDBCache.loadRestInfo(userId);
  }
};

// REST 정보 실시간 동기화 구독
export const subscribeToRestInfo = (userId: string, callback: (restInfo: RestInfo | null) => void): (() => void) => {
  const userRef = ref(database, `users/${userId}/restInfo`);

  const unsubscribe = onValue(userRef, async (snapshot) => {
    if (snapshot.exists()) {
      const restInfo = snapshot.val();
      // IndexedDB 캐시에 저장
      await indexedDBCache.saveRestInfo(restInfo, userId);
      callback(restInfo);
    } else {
      // Firebase에 데이터가 없으면 IndexedDB에서 확인
      const cachedRestInfo = await indexedDBCache.loadRestInfo(userId);
      callback(cachedRestInfo);
    }
  }, (error) => {
    console.error('REST 정보 동기화 오류:', error);
    // 오류 발생 시 IndexedDB에서 불러오기
    indexedDBCache.loadRestInfo(userId).then(callback);
  });

  return unsubscribe;
};

// 기존 스케줄 찾기 (날짜, 편명, 노선으로 매칭)
export const findExistingSchedule = async (userId: string, flight: any): Promise<{ flightId: string, version: number } | null> => {
  try {
    if (isFirebaseOffline()) {
      return null;
    }

    // 날짜 형식 변환 및 연도/월 추출
    let normalizedDate = flight.date;

    // 08Sep25 형식을 2025-09-08 형식으로 변환
    if (flight.date.match(/^\d{2}[A-Za-z]{3}\d{2}$/)) {
      const day = flight.date.substring(0, 2);
      const month = flight.date.substring(2, 5);
      const year = '20' + flight.date.substring(5, 7);

      const monthMap: { [key: string]: string } = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };

      const monthNum = monthMap[month] || '01';
      normalizedDate = `${year}-${monthNum}-${day}`;
    }

    // 날짜에서 연도와 월 추출
    const dateParts = normalizedDate.split('-');
    const year = dateParts[0];
    const month = dateParts[1];

    const flightsRef = ref(database, `users/${userId}/flights/${year}/${month}`);
    const snapshot = await get(flightsRef);

    if (!snapshot.exists()) {
      return null;
    }

    const monthFlights = snapshot.val();

    // 같은 날짜, 편명, 노선을 가진 스케줄 찾기
    for (const [flightId, flightData] of Object.entries(monthFlights)) {
      const existingFlight = flightData as any;

      // VAC 스케줄의 경우 route 비교를 다르게 처리
      let routeMatches = false;
      if (flight.flightNumber === 'VAC_R' || flight.flightNumber === 'VAC') {
        // VAC 스케줄은 편명만으로 비교
        routeMatches = true;
      } else {
        // 일반 비행 스케줄은 route도 비교
        routeMatches = existingFlight.route === flight.route;
      }

      if (existingFlight.date === normalizedDate &&
        existingFlight.flightNumber === flight.flightNumber &&
        routeMatches) {
        return {
          flightId: flightId,
          version: existingFlight.version || 0
        };
      }
    }

    return null;
  } catch (error) {
    console.error('기존 스케줄 찾기 오류:', error);
    return null;
  }
};

// 비행 스케줄 저장 (Flight 타입 사용)
export const saveFlightSchedule = async (userId: string, flight: any): Promise<void> => {
  try {
    if (isFirebaseOffline()) {
      return;
    }

    // 날짜 형식 변환 및 연도/월 추출
    let normalizedDate = flight.date;

    // 08Sep25 형식을 2025-09-08 형식으로 변환
    if (flight.date.match(/^\d{2}[A-Za-z]{3}\d{2}$/)) {
      const day = flight.date.substring(0, 2);
      const month = flight.date.substring(2, 5);
      const year = '20' + flight.date.substring(5, 7);

      const monthMap: { [key: string]: string } = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };

      const monthNum = monthMap[month] || '01';
      normalizedDate = `${year}-${monthNum}-${day}`;
    }

    // 날짜에서 연도와 월 추출
    const dateParts = normalizedDate.split('-');
    const year = dateParts[0];
    const month = dateParts[1];

    // 기존 스케줄 찾기
    const existingSchedule = await findExistingSchedule(userId, flight);

    let flightToSave;
    let flightRef;

    if (existingSchedule) {
      // 기존 스케줄이 있으면 버전 업데이트
      const newVersion = existingSchedule.version + 1;
      flightToSave = transformCrewFieldsForWrite({
        ...flight,
        date: normalizedDate,
        version: newVersion,
        lastUpdated: new Date().toISOString()
      });

      // 기존 스케줄 업데이트
      flightRef = ref(database, `users/${userId}/flights/${year}/${month}/${existingSchedule.flightId}`);
      await update(flightRef, flightToSave);

    } else {
      // 새로운 스케줄이면 버전 0으로 생성
      flightToSave = transformCrewFieldsForWrite({
        ...flight,
        date: normalizedDate,
        version: 0,
        lastUpdated: flight.lastUpdated || new Date().toISOString()
      });

      // 새로운 스케줄 저장
      flightRef = ref(database, `users/${userId}/flights/${year}/${month}/${flight.id}`);
      await set(flightRef, flightToSave);

    }

  } catch (error) {
    console.error('Error saving flight schedule:', error);
    throw error;
  }
};

// 비행 스케줄 불러오기 (연도별)
export const getFlightSchedules = async (userId: string, year: string): Promise<{ [month: string]: { [flightId: string]: any } } | null> => {
  try {
    if (isFirebaseOffline()) {
      return null;
    }

    const flightsRef = ref(database, `users/${userId}/flights/${year}`);
    const snapshot = await get(flightsRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.val();
  } catch (error) {
    console.error('Error getting flight schedules:', error);
    return null;
  }
};

// 비행 스케줄 실시간 동기화 구독
export const subscribeToFlightSchedules = (userId: string, year: string, callback: (flights: { [month: string]: { [flightId: string]: any } } | null) => void): (() => void) => {
  const flightsRef = ref(database, `users/${userId}/flights/${year}`);

  const unsubscribe = onValue(flightsRef, (snapshot) => {
    if (snapshot.exists()) {
      const flights = snapshot.val();
      callback(flights);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('비행 스케줄 동기화 오류:', error);
    callback(null);
  });

  return unsubscribe;
};


// --- Friends Feature Functions ---

// 이메일 주소에서 특수문자 제거 (Firebase 키용)
const sanitizeEmail = (email: string): string => {
  return email.toLowerCase().replace(/\./g, ',');
};

// 이메일-UID 매핑 저장
export const saveEmailToUidMapping = async (email: string, userId: string): Promise<void> => {
  try {
    if (!email || !userId || isFirebaseOffline()) return;
    const sanitizedEmail = sanitizeEmail(email);
    const mappingRef = ref(database, `emailToUid/${sanitizedEmail}`);
    await set(mappingRef, userId);
  } catch (error) {
    console.error('이메일-UID 매핑 저장 실패:', error);
  }
};

// 이메일로 UID 찾기
export const getUidByEmail = async (email: string): Promise<string | null> => {
  try {
    if (isFirebaseOffline()) return null;
    const sanitizedEmail = sanitizeEmail(email);
    const mappingRef = ref(database, `emailToUid/${sanitizedEmail}`);
    const snapshot = await get(mappingRef);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error('이메일로 UID 찾기 실패:', error);
    return null;
  }
};

// 친구 요청 보내기
export const sendFriendRequest = async (fromUserId: string, fromEmail: string, fromName: string, toEmail: string): Promise<{ success: boolean; message: string }> => {
  try {
    if (isFirebaseOffline()) return { success: false, message: '오프라인 상태에서는 친구 요청을 보낼 수 없습니다.' };

    const toUserId = await getUidByEmail(toEmail);
    if (!toUserId) {
      return { success: false, message: '등록되지 않은 이메일입니다.' };
    }

    if (fromUserId === toUserId) {
      return { success: false, message: '자기 자신에게 친구 요청을 보낼 수 없습니다.' };
    }

    // 이미 친구인지 확인
    const friendsRef = ref(database, `users/${fromUserId}/friends/${toUserId}`);
    const friendSnapshot = await get(friendsRef);
    if (friendSnapshot.exists()) {
      return { success: false, message: '이미 친구 관계입니다.' };
    }

    // 이미 보낸 요청이 있는지 확인 (중복 요청 방지)
    const requestRef = ref(database, `users/${toUserId}/friendRequests/${fromUserId}`);
    await set(requestRef, {
      from: fromUserId,
      email: fromEmail,
      name: fromName,
      status: 'pending',
      timestamp: Date.now()
    });

    return { success: true, message: '친구 요청을 보냈습니다.' };
  } catch (error) {
    console.error('친구 요청 보내기 실패:', error);
    return { success: false, message: '친구 요청 중 오류가 발생했습니다.' };
  }
};

// 친구 요청 수락
export const acceptFriendRequest = async (userId: string, friendUserId: string): Promise<void> => {
  try {
    if (isFirebaseOffline()) return;

    // 친구 목록에 추가 (양방향)
    const myFriendRef = ref(database, `users/${userId}/friends/${friendUserId}`);
    const theirFriendRef = ref(database, `users/${friendUserId}/friends/${userId}`);

    await Promise.all([
      set(myFriendRef, true),
      set(theirFriendRef, true)
    ]);

    // 요청 삭제
    const requestRef = ref(database, `users/${userId}/friendRequests/${friendUserId}`);
    await remove(requestRef);
  } catch (error) {
    console.error('친구 요청 수락 실패:', error);
  }
};

// 친구 요청 거절/삭제
export const rejectFriendRequest = async (userId: string, friendUserId: string): Promise<void> => {
  try {
    if (isFirebaseOffline()) return;
    const requestRef = ref(database, `users/${userId}/friendRequests/${friendUserId}`);
    await remove(requestRef);
  } catch (error) {
    console.error('친구 요청 거절 실패:', error);
  }
};

// 친구 목록 가져오기 (UID 리스트)
export const getFriends = async (userId: string): Promise<string[]> => {
  try {
    if (isFirebaseOffline()) return [];
    const friendsRef = ref(database, `users/${userId}/friends`);
    const snapshot = await get(friendsRef);
    if (!snapshot.exists()) return [];
    return Object.keys(snapshot.val());
  } catch (error) {
    console.error('친구 목록 가져오기 실패:', error);
    return [];
  }
};

// 친구 해제 (양방향 삭제)
export const removeFriend = async (userId: string, friendUserId: string): Promise<void> => {
  try {
    if (isFirebaseOffline()) return;
    const myFriendRef = ref(database, `users/${userId}/friends/${friendUserId}`);
    const theirFriendRef = ref(database, `users/${friendUserId}/friends/${userId}`);
    await Promise.all([
      remove(myFriendRef),
      remove(theirFriendRef)
    ]);
  } catch (error) {
    console.error('친구 해제 실패:', error);
  }
};

// 친구 요청 목록 가져오기
export const getFriendRequests = async (userId: string): Promise<any[]> => {
  try {
    if (isFirebaseOffline()) return [];
    const requestsRef = ref(database, `users/${userId}/friendRequests`);
    const snapshot = await get(requestsRef);
    if (!snapshot.exists()) return [];

    const requestsData = snapshot.val();
    return Object.keys(requestsData).map(key => ({
      friendUserId: key,
      ...requestsData[key]
    }));
  } catch (error) {
    console.error('친구 요청 목록 가져오기 실패:', error);
    return [];
  }
};

// 친구 목록 실시간 구독
export const subscribeFriends = (userId: string, callback: (uids: string[]) => void): (() => void) => {
  const friendsRef = ref(database, `users/${userId}/friends`);
  const unsubscribe = onValue(friendsRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(Object.keys(snapshot.val()));
    } else {
      callback([]);
    }
  }, (error) => {
    console.error('친구 목록 구독 오류:', error);
    callback([]);
  });
  return unsubscribe;
};

// 친구 요청 실시간 구독
export const subscribeFriendRequests = (userId: string, callback: (requests: any[]) => void): (() => void) => {
  const requestsRef = ref(database, `users/${userId}/friendRequests`);
  const unsubscribe = onValue(requestsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.keys(data).map(key => ({ friendUserId: key, ...data[key] })));
    } else {
      callback([]);
    }
  }, (error) => {
    console.error('친구 요청 구독 오류:', error);
    callback([]);
  });
  return unsubscribe;
};

// UID로 사용자 정보 가져오기 (친구 목록 표시용)
// settings 하위에 저장된 프로필 정보를 읽어옴
export const getUserInfoByUid = async (userId: string): Promise<any | null> => {
  try {
    if (isFirebaseOffline()) return null;
    const basePath = `users/${userId}`;

    // 전체 settings 객체와 displayName을 가져옴
    const [
      settingsSnap,
      displayNameSnap,
    ] = await Promise.all([
      get(ref(database, `${basePath}/settings`)),
      get(ref(database, `${basePath}/displayName`)),
    ]);

    const displayName = displayNameSnap.exists() ? displayNameSnap.val() : null;
    let settingsData: any = {};

    if (settingsSnap.exists()) {
      const rawSettings = settingsSnap.val();
      // 읽어온 설정을 평문으로 복호화
      try {
        const decryptedSettings = await decryptUserSettings(rawSettings, userId);
        settingsData = { ...rawSettings, ...decryptedSettings };
      } catch (e) {
        console.error('친구 설정 복호화 실패:', e);
        settingsData = rawSettings;
      }
    }

    const settingsUserName = settingsData.userName || null;
    const company = settingsData.company || settingsData.airline || '';
    const base = settingsData.base || '';

    const name = displayName || settingsUserName;
    if (!name) return null;

    return {
      displayName: name,
      email: '',
      company: company || '',
      base: base || ''
    };
  } catch (error) {
    console.error('사용자 정보 가져오기 실패:', error);
    return null;
  }
};

// ==========================================
// [신규 시스템] 카카오 연동 시 데이터 마이그레이션
// ==========================================
// 기존 이메일 계정의 데이터를 새로운 카카오 계정으로 100% 이전하고, 원본을 삭제하는 함수
export const migrateAccountData = async (oldUid: string, newUid: string): Promise<boolean> => {
  try {
    console.log(`🔄 데이터 마이그레이션 시작 (백엔드 API 호출): ${oldUid} -> ${newUid}`);
    if (!oldUid || !newUid || oldUid === newUid) return false;

    // Vercel Serverless Function 호출 (Admin 권한으로 Permission 우회)
    const response = await fetch('/api/auth/migrate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ oldUid, newUid }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`백엔드 마이그레이션 실패: ${response.status} ${errText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`마이그레이션 API 에러: ${data.error}`);
    }

    console.log(`✅ 새 카카오 계정(${newUid})으로 데이터 복사 완료 (API 응답):`, data.message);

    // 5. 알림 인덱스 재생성 (방금 새로 만든 계정 기준, 클라이언트 사이드 유지)
    try {
      await syncAlarmIndexes(newUid);
    } catch (e) {
      console.warn('⚠️ syncAlarmIndexes 실패 (무시됨):', e);
    }

    return true;
  } catch (error) {
    console.error('❌ 카카오 데이터 마이그레이션에 실패:', error);
    return false;
  }
};

// ==========================================
// [카카오 친구 추천] 카카오 ID ↔ Firebase UID 매핑
// ==========================================

// 카카오 ID → Firebase UID 매핑 저장
export const saveKakaoIdToUidMapping = async (kakaoId: string, userId: string): Promise<void> => {
  try {
    if (!kakaoId || !userId || isFirebaseOffline()) return;
    const mappingRef = ref(database, `kakaoIdToUid/${kakaoId}`);
    await set(mappingRef, userId);
  } catch (error) {
    console.error('카카오ID-UID 매핑 저장 실패:', error);
  }
};

// 카카오 ID로 Firebase UID 찾기
export const getUidByKakaoId = async (kakaoId: string): Promise<string | null> => {
  try {
    if (isFirebaseOffline()) return null;
    const mappingRef = ref(database, `kakaoIdToUid/${kakaoId}`);
    const snapshot = await get(mappingRef);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error('카카오ID로 UID 찾기 실패:', error);
    return null;
  }
};

// 카카오 액세스 토큰 저장 (Firebase DB에 저장, 친구 목록 조회용)
export const saveKakaoAccessToken = async (userId: string, token: string): Promise<void> => {
  try {
    if (!userId || !token || isFirebaseOffline()) return;
    const tokenRef = ref(database, `users/${userId}/kakaoAccessToken`);
    await set(tokenRef, token);
  } catch (error) {
    console.error('카카오 액세스 토큰 저장 실패:', error);
  }
};

// 카카오 액세스 토큰 조회
export const getKakaoAccessToken = async (userId: string): Promise<string | null> => {
  try {
    if (isFirebaseOffline()) return null;
    const tokenRef = ref(database, `users/${userId}/kakaoAccessToken`);
    const snapshot = await get(tokenRef);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error('카카오 액세스 토큰 조회 실패:', error);
    return null;
  }
};

// UID 기반 직접 친구 요청 보내기 (카카오 친구 추천용)
export const sendFriendRequestByUid = async (fromUserId: string, fromName: string, toUserId: string): Promise<{ success: boolean; message: string }> => {
  try {
    if (isFirebaseOffline()) return { success: false, message: '오프라인 상태에서는 친구 요청을 보낼 수 없습니다.' };

    if (fromUserId === toUserId) {
      return { success: false, message: '자기 자신에게 친구 요청을 보낼 수 없습니다.' };
    }

    // 이미 친구인지 확인
    const friendsRef = ref(database, `users/${fromUserId}/friends/${toUserId}`);
    const friendSnapshot = await get(friendsRef);
    if (friendSnapshot.exists()) {
      return { success: false, message: '이미 친구 관계입니다.' };
    }

    // 이미 보낸 요청이 있는지 확인
    const existingRef = ref(database, `users/${toUserId}/friendRequests/${fromUserId}`);
    const existingSnapshot = await get(existingRef);
    if (existingSnapshot.exists()) {
      return { success: false, message: '이미 친구 요청을 보냈습니다.' };
    }

    // 친구 요청 보내기
    const requestRef = ref(database, `users/${toUserId}/friendRequests/${fromUserId}`);
    await set(requestRef, {
      from: fromUserId,
      email: '',
      name: fromName,
      status: 'pending',
      timestamp: Date.now()
    });

    return { success: true, message: '친구 요청을 보냈습니다.' };
  } catch (error) {
    console.error('친구 요청 보내기 실패:', error);
    return { success: false, message: '친구 요청 중 오류가 발생했습니다.' };
  }
};

