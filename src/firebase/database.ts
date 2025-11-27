import { ref, get, set, push, update, remove, onValue, off, goOffline, goOnline } from "firebase/database";
import { database, auth } from "./config";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { encryptDocumentExpiryDates, decryptDocumentExpiryDates, upgradeDocumentExpiryDates, encryptCrewMemos, decryptCrewMemos, upgradeCrewMemos, encryptCityMemos, decryptCityMemos, upgradeCityMemos } from "../../utils/encryption";
import { indexedDBCache } from "../../utils/indexedDBCache";

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

// 날짜 형식 검증
const isValidDateFormat = (dateString: string): boolean => {
  if (!dateString) return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(dateString);
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
  const obj = arrayToIndexedObject(value);
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
    copy.cabinCrew = arrayToIndexedObject(copy.cabinCrew);
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

// Firebase 데이터베이스 연결 테스트
export const testDatabaseConnection = async (userId: string) => {
  try {

    if (!auth.currentUser) {
      // Firebase 인증되지 않음
      return { success: false, error: 'Firebase 인증되지 않음' };
    }

    const testRef = ref(database, `users/${userId}/test`);

    // 읽기 권한 테스트
    try {
      await get(testRef);
      // 읽기 권한 확인됨
    } catch (readError) {
      return { success: false, error: '읽기 권한 없음', details: readError };
    }

    // 쓰기 권한 테스트 (테스트 데이터 생성 후 삭제)
    try {
      const testData = { test: true, timestamp: Date.now() };
      const newRef = await pushData(`users/${userId}/test`, testData);
      // 쓰기 권한 확인됨

      // 테스트 데이터 삭제
      if (newRef) {
        const deleteRef = ref(database, `users/${userId}/test/${newRef}`);
        await remove(deleteRef);
      }

      return { success: true, message: 'Firebase 데이터베이스 연결 성공' };
    } catch (writeError) {
      return { success: false, error: '쓰기 권한 없음', details: writeError };
    }

  } catch (error) {
    console.error('❌ Firebase 데이터베이스 연결 테스트 실패:', error);
    return { success: false, error: '연결 테스트 실패', details: error };
  }
};

// 사용자의 모든 월의 비행 데이터 가져오기
export const getAllFlights = async (userId: string) => {
  try {
    // 오프라인 상태 체크
    if (isFirebaseOffline()) {
      console.log('❌ getAllFlights: 오프라인 모드임');
      return [];
    }

    if (!userId) {
      console.log('❌ getAllFlights: userId가 없음');
      return [];
    }

    console.log(`🔍 getAllFlights 호출됨: userId=${userId}`);

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


      return sortedFlights;

    } catch (dbError) {
      console.error('❌ Firebase 데이터베이스 읽기 오류:', dbError);

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
                  found = true;
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

  // 실제 데이터 존재 여부 확인
  try {
    const dataRef = ref(database, fullPath);
    const snapshot = await get(dataRef);
    if (!snapshot.exists()) {
      return false;
    }
  } catch (error) {
    console.error('🗑️ 데이터 존재 확인 중 오류:', error);
    return false;
  }

  const result = await deleteData(fullPath);
  return result;
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

// 사용자 설정 정보 저장 (암호화 없음)
export const saveUserSettings = async (userId: string, settings: { airline?: string; selectedCurrencyCards?: string[]; empl?: string; userName?: string; base?: string; company?: string }) => {
  try {
    const settingsPath = `users/${userId}/settings`;

    // 기존 설정을 먼저 가져오기
    const existingSettings = await readData(settingsPath) || {};

    // 기존 설정과 새로운 설정을 병합
    const mergedSettings = {
      ...existingSettings,
      ...settings
    };

    // 암호화 없이 직접 저장
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

// 사용자 설정 정보 가져오기 (암호화 없음)
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

    const normalizedSettings = {
      ...settings,
      base: settings.base ? String(settings.base).toUpperCase() : settings.base
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
    const encryptedExpiryDates = await readData(expiryDatesPath);

    if (!encryptedExpiryDates) {
      return {};
    }

    // 데이터 복호화 (기존 방식 우선)
    const decryptedExpiryDates = await decryptDocumentExpiryDates(encryptedExpiryDates, userId);

    // 업그레이드가 필요한지 확인 (기존 방식으로 복호화된 데이터가 있는지)
    const needsUpgrade = Object.values(encryptedExpiryDates).some((encryptedDate: string) => {
      try {
        // 기존 방식으로 복호화 시도
        const legacyResult = decryptDataLegacy(encryptedDate);
        return isValidDateFormat(legacyResult);
      } catch {
        return false;
      }
    });

    // 업그레이드가 필요한 경우에만 실행
    if (needsUpgrade) {
      try {
        // 모든 데이터를 새로운 방식으로 업그레이드
        const upgradedExpiryDates = await upgradeDocumentExpiryDates(encryptedExpiryDates, userId);

        // 업그레이드된 데이터를 Firebase에 저장
        await writeData(expiryDatesPath, upgradedExpiryDates);

        // 업그레이드된 데이터로 다시 복호화
        const upgradedDecryptedDates = await decryptDocumentExpiryDates(upgradedExpiryDates, userId);
        return upgradedDecryptedDates;
      } catch (upgradeError) {
        console.error('업그레이드 오류:', upgradeError);
        // 업그레이드 실패 시 기존 데이터 반환
        return decryptedExpiryDates;
      }
    }

    return decryptedExpiryDates;
  } catch (error) {
    console.error('Error getting document expiry dates:', error);
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

    // Firebase에 저장
    const memosRef = ref(database, `users/${userId}/crewMemos`);
    await set(memosRef, encryptedMemos);

  } catch (error) {
    console.error('Error saving crew memos:', error);
    // Firebase 저장 실패해도 IndexedDB에는 저장되어 있음
  }
};

// Crew 메모 불러오기
export const getCrewMemos = async (userId: string): Promise<{ [key: string]: string }> => {
  try {

    const memosRef = ref(database, `users/${userId}/crewMemos`);
    const snapshot = await get(memosRef);

    if (!snapshot.exists()) {
      // IndexedDB 캐시에서 확인
      const cachedEncryptedMemos = await indexedDBCache.loadCrewMemos(userId);
      if (Object.keys(cachedEncryptedMemos).length > 0) {
        // 암호화된 캐시 데이터 복호화
        const decryptedMemos = await decryptCrewMemos(cachedEncryptedMemos, userId);
        return decryptedMemos;
      }
      return {};
    }

    const encryptedMemos = snapshot.val() as { [key: string]: string };

    // 메모 복호화
    const decryptedMemos = await decryptCrewMemos(encryptedMemos, userId);

    // 업그레이드 필요성 확인 및 자동 업그레이드
    const needsUpgrade = Object.values(encryptedMemos).some(encryptedMemo => {
      try {
        const legacyDecrypted = decryptDataLegacy(encryptedMemo);
        return legacyDecrypted && legacyDecrypted.trim();
      } catch {
        return false;
      }
    });

    // 업그레이드가 필요한 경우에만 실행
    if (needsUpgrade) {
      try {
        const upgradedMemos = await upgradeCrewMemos(encryptedMemos, userId);
        await set(memosRef, upgradedMemos);

        // 업그레이드된 데이터로 다시 복호화
        const upgradedDecryptedMemos = await decryptCrewMemos(upgradedMemos, userId);

        // IndexedDB 캐시에 암호화된 상태로 저장
        await indexedDBCache.saveCrewMemos(upgradedMemos, userId);

        return upgradedDecryptedMemos;
      } catch (upgradeError) {
        console.error('Crew 메모 업그레이드 오류:', upgradeError);
        // 업그레이드 실패 시 기존 데이터 반환

        // IndexedDB 캐시에 암호화된 상태로 저장
        await indexedDBCache.saveCrewMemos(encryptedMemos, userId);

        return decryptedMemos;
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
      const decryptedMemos = await decryptCrewMemos(cachedEncryptedMemos, userId);
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

    // Firebase에 저장
    const userRef = ref(database, `users/${userId}/cityMemos`);
    await set(userRef, encryptedMemos);

  } catch (error) {
    console.error('Error saving city memos:', error);
    // Firebase 저장 실패해도 IndexedDB에는 저장되어 있음
  }
};

// 도시 메모 불러오기
export const getCityMemos = async (userId: string): Promise<{ [key: string]: string }> => {
  try {

    const userRef = ref(database, `users/${userId}/cityMemos`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      // IndexedDB 캐시에서 확인
      const cachedEncryptedMemos = await indexedDBCache.loadCityMemos(userId);
      if (Object.keys(cachedEncryptedMemos).length > 0) {
        // 암호화된 캐시 데이터 복호화
        const decryptedMemos = await decryptCityMemos(cachedEncryptedMemos, userId);
        return decryptedMemos;
      }
      return {};
    }

    const encryptedMemos = snapshot.val();

    // 메모 복호화
    const decryptedMemos = await decryptCityMemos(encryptedMemos, userId);

    // 업그레이드가 필요한지 확인 (레거시 데이터가 있는 경우)
    const needsUpgrade = Object.values(encryptedMemos).some((memo: any) =>
      typeof memo === 'string' && !memo.includes('|')
    );

    // 업그레이드가 필요한 경우에만 실행
    if (needsUpgrade) {
      try {
        // 업그레이드 실행
        const upgradedMemos = await upgradeCityMemos(encryptedMemos, userId);

        // 업그레이드된 데이터를 Firebase에 저장
        await set(userRef, upgradedMemos);

        // 업그레이드된 데이터로 다시 복호화
        const upgradedDecryptedMemos = await decryptCityMemos(upgradedMemos, userId);

        // IndexedDB 캐시에 암호화된 상태로 저장
        await indexedDBCache.saveCityMemos(upgradedMemos, userId);

        return upgradedDecryptedMemos;
      } catch (upgradeError) {
        console.error('도시 메모 업그레이드 오류:', upgradeError);
        // 업그레이드 실패 시 기존 데이터 반환

        // IndexedDB 캐시에 암호화된 상태로 저장
        await indexedDBCache.saveCityMemos(encryptedMemos, userId);

        return decryptedMemos;
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
      const decryptedMemos = await decryptCityMemos(cachedEncryptedMemos, userId);
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

