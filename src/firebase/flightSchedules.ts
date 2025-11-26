import { ref, get, set, update } from "firebase/database";
import { database } from "./config";
import { indexedDBCache } from "../../utils/indexedDBCache";
import { convertFlightNumberToIATA } from "../../utils/airlineData";

export interface FlightScheduleDB {
  flightNumber: string;
  airline: string;
  route: string;
  departure: string;
  arrival: string;
  cachedAt?: number;
}

// Firebase에서 읽은 축약 데이터를 앱에서 사용하는 형식으로 변환
function parseCompressedFlight(flightNumber: string, data: { dep: string, arr: string }): FlightScheduleDB {
  const airline = flightNumber.replace(/[0-9]/g, '');
  return {
    flightNumber: flightNumber.toUpperCase(),
    airline: airline.toUpperCase(),
    departure: data.dep,
    arrival: data.arr,
    route: `${data.dep}-${data.arr}`
  };
}

// 항공편 스케줄 가져오기 (Firebase + IndexedDB 캐싱)
export const getFlightSchedule = async (flightNumber: string): Promise<FlightScheduleDB | null> => {
  try {
    const upperFlightNumber = flightNumber.toUpperCase();

    // 오프라인 모드: IndexedDB에서만 읽기
    if (!navigator.onLine) {
      console.log('📴 오프라인 모드: IndexedDB에서 읽기');
      return await indexedDBCache.loadFlightSchedule(upperFlightNumber);
    }

    // 온라인 모드: Firebase에서 읽고 IndexedDB에 캐싱
    const airline = upperFlightNumber.replace(/[0-9]/g, '');
    const flightRef = ref(database, `fs/a/${airline}/${upperFlightNumber}`);
    const snapshot = await get(flightRef);

    if (snapshot.exists()) {
      const data = snapshot.val();
      const parsed = parseCompressedFlight(upperFlightNumber, data);

      // IndexedDB에 캐싱
      await indexedDBCache.saveFlightSchedule(parsed);

      return parsed;
    }

    // Firebase에 없으면 IndexedDB 확인 (오래된 캐시라도 사용)
    return await indexedDBCache.loadFlightSchedule(upperFlightNumber);

  } catch (error) {
    console.error('❌ Firebase 항공편 스케줄 조회 실패:', error);

    // 오류 발생 시 IndexedDB 폴백
    return await indexedDBCache.loadFlightSchedule(flightNumber.toUpperCase());
  }
};

// 항공편 스케줄 검색 (Firebase + IndexedDB 캐싱)
export const searchFlightSchedules = async (searchQuery: string): Promise<FlightScheduleDB[]> => {
  try {
    // ICAO 코드(3자리)를 IATA 코드(2자리)로 변환 (예: AAR123 -> OZ123)
    // 이미 IATA 코드이거나 숫자만 있는 경우는 그대로 반환됨
    const convertedQuery = convertFlightNumberToIATA(searchQuery);
    const upperQuery = convertedQuery.toUpperCase();

    console.log(`🔍 항공편 검색: ${searchQuery} -> ${upperQuery}`);

    // 오프라인 모드: IndexedDB에서만 검색
    if (!navigator.onLine) {
      console.log('📴 오프라인 모드: IndexedDB에서 검색');
      return await indexedDBCache.searchFlightSchedules(upperQuery);
    }

    // 온라인 모드: Firebase에서 검색
    const results: FlightScheduleDB[] = [];
    const airlineMatch = upperQuery.match(/^([A-Z0-9]{2})/);

    if (!airlineMatch) {
      // 항공사 코드가 없으면 IndexedDB에서 검색
      return await indexedDBCache.searchFlightSchedules(upperQuery);
    }

    const airlineCode = airlineMatch[1];
    const airlineRef = ref(database, `fs/a/${airlineCode}`);
    const snapshot = await get(airlineRef);

    if (snapshot.exists()) {
      const flights = snapshot.val();
      Object.keys(flights).forEach(flightNumber => {
        if (flightNumber.includes(upperQuery)) {
          const parsed = parseCompressedFlight(flightNumber, flights[flightNumber]);
          results.push(parsed);
        }
      });

      // 검색 결과를 IndexedDB에 캐싱
      if (results.length > 0) {
        await indexedDBCache.saveFlightSchedules(results);
      }
    }

    // Firebase에서 찾지 못하면 IndexedDB 확인
    if (results.length === 0) {
      return await indexedDBCache.searchFlightSchedules(upperQuery);
    }

    return results;

  } catch (error) {
    console.error('❌ Firebase 항공편 검색 실패:', error);

    // 오류 발생 시 IndexedDB 폴백
    return await indexedDBCache.searchFlightSchedules(searchQuery.toUpperCase());
  }
};

// 항공사별 모든 항공편 가져오기 (Firebase + IndexedDB 캐싱)
export const getAirlineFlights = async (airlineCode: string): Promise<FlightScheduleDB[]> => {
  try {
    const upperAirlineCode = airlineCode.toUpperCase();

    // 오프라인 모드: IndexedDB에서만 읽기
    if (!navigator.onLine) {
      console.log('📴 오프라인 모드: IndexedDB에서 읽기');
      return await indexedDBCache.loadAirlineSchedules(upperAirlineCode);
    }

    // 온라인 모드: Firebase에서 읽고 IndexedDB에 캐싱
    const airlineRef = ref(database, `fs/a/${upperAirlineCode}`);
    const snapshot = await get(airlineRef);

    if (snapshot.exists()) {
      const flights = snapshot.val();
      const flightArray: FlightScheduleDB[] = [];

      Object.keys(flights).forEach(flightNumber => {
        const parsed = parseCompressedFlight(flightNumber, flights[flightNumber]);
        flightArray.push(parsed);
      });

      // IndexedDB에 캐싱
      if (flightArray.length > 0) {
        await indexedDBCache.saveFlightSchedules(flightArray);
      }

      return flightArray;
    }

    // Firebase에 없으면 IndexedDB 확인
    return await indexedDBCache.loadAirlineSchedules(upperAirlineCode);

  } catch (error) {
    console.error('❌ Firebase 항공사 항공편 조회 실패:', error);

    // 오류 발생 시 IndexedDB 폴백
    return await indexedDBCache.loadAirlineSchedules(airlineCode.toUpperCase());
  }
};

// 도시(IATA 코드)로 항공편 검색 (Firebase + IndexedDB 캐싱)
export const searchFlightSchedulesByCity = async (cityCode: string): Promise<FlightScheduleDB[]> => {
  try {
    const upperCityCode = cityCode.toUpperCase();
    console.log('🔍 도시 코드로 항공편 검색:', upperCityCode);

    // 오프라인 모드: IndexedDB에서만 검색
    if (!navigator.onLine) {
      console.log('📴 오프라인 모드: IndexedDB에서 검색');
      const cachedFlights = await indexedDBCache.searchFlightSchedules('');
      return cachedFlights.filter(flight =>
        flight.departure === upperCityCode || flight.arrival === upperCityCode
      );
    }

    // 온라인 모드: Firebase의 모든 항공사 데이터 검색
    const results: FlightScheduleDB[] = [];
    const airlinesRef = ref(database, 'fs/a');
    const snapshot = await get(airlinesRef);

    if (snapshot.exists()) {
      const airlines = snapshot.val();

      const allFlightsToCache: FlightScheduleDB[] = [];

      // 각 항공사의 항공편을 순회하면서 도시 코드와 일치하는 항공편 찾기
      Object.keys(airlines).forEach(airlineCode => {
        const flights = airlines[airlineCode];
        Object.keys(flights).forEach(flightNumber => {
          const flightData = flights[flightNumber];

          // 모든 항공편을 파싱하여 캐시 목록에 추가 (오프라인 검색을 위해)
          if (flightData.dep && flightData.arr) {
            const parsed = parseCompressedFlight(flightNumber, flightData);
            allFlightsToCache.push(parsed);

            // 검색 조건(도시 코드)과 일치하면 결과 목록에도 추가
            if (flightData.dep === upperCityCode || flightData.arr === upperCityCode) {
              results.push(parsed);
            }
          }
        });
      });

      console.log('🔍 Firebase DB에서 찾은 검색 결과:', results.length, '개');
      console.log('💾 오프라인용 전체 데이터 캐싱:', allFlightsToCache.length, '개 항공편');

      // 전체 데이터를 IndexedDB에 캐싱 (검색 결과뿐만 아니라 모든 데이터)
      if (allFlightsToCache.length > 0) {
        await indexedDBCache.saveFlightSchedules(allFlightsToCache);
      }
    }

    return results;

  } catch (error) {
    console.error('❌ Firebase 도시별 항공편 검색 실패:', error);

    // 오류 발생 시 IndexedDB 폴백
    const cachedFlights = await indexedDBCache.searchFlightSchedules('');
    return cachedFlights.filter(flight =>
      flight.departure === cityCode.toUpperCase() || flight.arrival === cityCode.toUpperCase()
    );
  }
};

// 메타데이터 가져오기
export const getFlightScheduleMetadata = async (): Promise<{ sync: string, total: number, version: string } | null> => {
  try {
    if (!navigator.onLine) {
      return null;
    }

    const metadataRef = ref(database, 'fs/m');
    const snapshot = await get(metadataRef);

    if (snapshot.exists()) {
      const data = snapshot.val();
      return {
        sync: data.s || '',
        total: data.t || 0,
        version: data.v || ''
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Firebase 메타데이터 조회 실패:', error);
    return null;
  }
};

// JSON 파일에서 항공편 데이터 파싱 및 Firebase 업로드
export const uploadFlightSchedulesFromJSON = async (jsonData: any): Promise<{ success: boolean, message: string, uploadedCount?: number }> => {
  try {
    console.log('🔍 JSON 업로드 시작...');

    if (!navigator.onLine) {
      console.log('❌ 오프라인 상태');
      return {
        success: false,
        message: '오프라인 상태에서는 업로드할 수 없습니다.'
      };
    }

    // JSON 형식 검증
    if (!jsonData || !jsonData.fs || !jsonData.fs.a) {
      console.log('❌ JSON 형식 오류:', jsonData);
      return {
        success: false,
        message: 'JSON 형식이 올바르지 않습니다. fs.a 구조가 필요합니다.'
      };
    }

    const airlinesData = jsonData.fs.a;
    const metadata = jsonData.fs.m;

    console.log('📊 항공사 데이터:', Object.keys(airlinesData));
    console.log('📊 메타데이터:', metadata);

    let totalFlights = 0;
    const parsedSchedules: FlightScheduleDB[] = [];

    // 모든 항공사 데이터 파싱
    for (const airlineCode in airlinesData) {
      const flights = airlinesData[airlineCode];
      console.log(`📊 ${airlineCode} 항공사: ${Object.keys(flights).length}개 항공편`);

      for (const flightNumber in flights) {
        const flightData = flights[flightNumber];

        if (flightData.dep && flightData.arr) {
          const parsed = parseCompressedFlight(flightNumber, flightData);
          parsedSchedules.push(parsed);
          totalFlights++;
        }
      }
    }

    console.log(`📊 파싱 완료: ${totalFlights}개 항공편`);

    // Firebase에 업로드 (기존 데이터 완전 대체)
    console.log('🔍 Firebase 업로드 시작...');
    const fsRef = ref(database, 'fs');

    // 기존 fs 데이터 삭제
    console.log('🗑️ 기존 fs 데이터 삭제 중...');
    await set(fsRef, null);

    const uploadData = {
      a: airlinesData,
      m: metadata || {
        s: new Date().toISOString(),
        t: totalFlights,
        v: '2.1'
      }
    };

    console.log('📊 업로드 데이터 크기:', JSON.stringify(uploadData).length, 'bytes');
    console.log('📊 항공사 수:', Object.keys(airlinesData).length);
    console.log('📊 총 항공편 수:', totalFlights);

    // 새 데이터로 완전 대체
    await set(fsRef, uploadData);

    console.log('✅ Firebase 업로드 완료');

    // IndexedDB에 캐싱
    if (parsedSchedules.length > 0) {
      console.log('🔍 IndexedDB 캐싱 시작...');
      await indexedDBCache.saveFlightSchedules(parsedSchedules);
      console.log('✅ IndexedDB 캐싱 완료');
    }

    return {
      success: true,
      message: `기존 데이터를 완전히 대체하여 ${totalFlights}개 항공편이 성공적으로 업로드되었습니다.`,
      uploadedCount: totalFlights
    };

  } catch (error) {
    console.error('❌ JSON 업로드 실패:', error);
    console.error('❌ 오류 상세:', error instanceof Error ? error.stack : error);
    return {
      success: false,
      message: `업로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    };
  }
};

// 백그라운드에서 전체 항공편 데이터 캐싱 (오프라인 대비)
export const cacheAllFlightsFromFirebase = async (): Promise<void> => {
  try {
    if (!navigator.onLine) return;

    // 최근 캐싱 시간 확인 (1시간 이내면 스킵)
    const lastCacheTime = localStorage.getItem('lastFlightCacheTime');
    if (lastCacheTime) {
      const timeDiff = Date.now() - parseInt(lastCacheTime);
      if (timeDiff < 60 * 60 * 1000) {
        console.log('⏳ 최근에 캐싱됨, 스킵:', Math.round(timeDiff / 60000), '분 전');
        return;
      }
    }

    console.log('💾 백그라운드 데이터 캐싱 시작...');
    const airlinesRef = ref(database, 'fs/a');
    const snapshot = await get(airlinesRef);

    if (snapshot.exists()) {
      const airlines = snapshot.val();
      const allFlightsToCache: FlightScheduleDB[] = [];

      Object.keys(airlines).forEach(airlineCode => {
        const flights = airlines[airlineCode];
        Object.keys(flights).forEach(flightNumber => {
          const flightData = flights[flightNumber];
          if (flightData.dep && flightData.arr) {
            const parsed = parseCompressedFlight(flightNumber, flightData);
            allFlightsToCache.push(parsed);
          }
        });
      });

      if (allFlightsToCache.length > 0) {
        await indexedDBCache.saveFlightSchedules(allFlightsToCache);
        localStorage.setItem('lastFlightCacheTime', Date.now().toString());
        console.log('✅ 백그라운드 데이터 캐싱 완료:', allFlightsToCache.length, '개');
      }
    }
  } catch (error) {
    console.error('❌ 백그라운드 캐싱 실패:', error);
  }
};

