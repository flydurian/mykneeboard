import { ref, get, set, push, update, remove, onValue, off } from "firebase/database";
import { database } from "./config";

// 데이터 읽기
export const readData = async (path: string) => {
  try {
    const dataRef = ref(database, path);
    const snapshot = await get(dataRef);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error("Error reading data:", error);
    throw error;
  }
};

// 데이터 쓰기
export const writeData = async (path: string, data: any) => {
  try {
    const dataRef = ref(database, path);
    await set(dataRef, data);
    return true;
  } catch (error) {
    console.error("Error writing data:", error);
    throw error;
  }
};

// 데이터 추가 (자동 키 생성)
export const pushData = async (path: string, data: any) => {
  try {
    console.log('pushData called with:', { path, data });
    
    const dataRef = ref(database, path);
    console.log('Database reference created for path:', path);
    
    const newRef = push(dataRef);
    console.log('New reference created:', newRef.key);
    
    await set(newRef, data);
    console.log('Data set successfully');
    
    return newRef.key;
  } catch (error) {
    console.error("Error pushing data:", error);
    console.error("Error details:", {
      code: error.code,
      message: error.message,
      path: path
    });
    throw error;
  }
};

// 데이터 업데이트
export const updateData = async (path: string, data: any) => {
  try {
    const dataRef = ref(database, path);
    await update(dataRef, data);
    return true;
  } catch (error) {
    console.error("Error updating data:", error);
    throw error;
  }
};

// 데이터 삭제
export const deleteData = async (path: string) => {
  try {
    const dataRef = ref(database, path);
    await remove(dataRef);
    return true;
  } catch (error) {
    console.error("Error deleting data:", error);
    throw error;
  }
};

// 실시간 데이터 리스너
export const subscribeToData = (path: string, callback: (data: any) => void) => {
  const dataRef = ref(database, path);
  onValue(dataRef, (snapshot) => {
    const data = snapshot.exists() ? snapshot.val() : null;
    callback(data);
  });
  
  // 구독 해제 함수 반환
  return () => off(dataRef);
};

// 사용자별 월별 데이터 경로 생성 함수
const getMonthPath = (date: string, userId: string) => {
  const dateObj = new Date(date);
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1; // 0-based to 1-based
  return `users/${userId}/flights/${year}/${month.toString().padStart(2, '0')}`;
};

// 사용자의 모든 월의 비행 데이터 가져오기
export const getAllFlights = async (userId: string) => {
  try {
    console.log('getAllFlights called with userId:', userId);
    
    if (!userId) {
      console.log('No userId provided, returning empty array');
      return [];
    }
    
    const allFlightsRef = ref(database, `users/${userId}/flights`);
    console.log('Database reference path:', `users/${userId}/flights`);
    
    const snapshot = await get(allFlightsRef);
    console.log('Snapshot exists:', snapshot.exists());
    
    if (!snapshot.exists()) {
      console.log('No data found for user, returning empty array');
      return [];
    }
    
    const allFlights: any[] = [];
    const yearData = snapshot.val();
    console.log('Year data keys:', Object.keys(yearData));
    
    // 모든 연도와 월을 순회
    Object.keys(yearData).forEach(year => {
      Object.keys(yearData[year]).forEach(month => {
        const monthFlights = yearData[year][month];
        if (monthFlights) {
          Object.keys(monthFlights).forEach(flightKey => {
            allFlights.push({
              ...monthFlights[flightKey],
              id: parseInt(flightKey)
            });
          });
        }
      });
    });
    
    console.log('Total flights found:', allFlights.length);
    return allFlights.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } catch (error) {
    console.error('Error getting all flights:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      userId: userId
    });
    
    // 권한 오류인 경우 빈 배열 반환
    if (error.code === 'PERMISSION_DENIED') {
      console.log('Permission denied, returning empty array');
      return [];
    }
    
    throw error;
  }
};

// 사용자의 특정 월의 비행 데이터 가져오기
export const getFlightsByMonth = async (year: number, month: number, userId: string) => {
  const monthPath = `users/${userId}/flights/${year}/${month.toString().padStart(2, '0')}`;
  return await readData(monthPath);
};

// 비행 데이터 추가 (사용자별 월별로 자동 분류)
export const addFlight = async (flightData: any, userId: string) => {
  const monthPath = getMonthPath(flightData.date, userId);
  return await pushData(monthPath, flightData);
};

// 비행 데이터 업데이트
export const updateFlight = async (flightId: string, flightData: any, userId: string) => {
  const monthPath = getMonthPath(flightData.date, userId);
  return await updateData(`${monthPath}/${flightId}`, flightData);
};

// 비행 데이터 삭제
export const deleteFlight = async (flightId: string, date: string, userId: string) => {
  const monthPath = getMonthPath(date, userId);
  return await deleteData(`${monthPath}/${flightId}`);
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
  const allFlightsRef = ref(database, `users/${userId}/flights`);
  onValue(allFlightsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    
    const allFlights: any[] = [];
    const yearData = snapshot.val();
    
    Object.keys(yearData).forEach(year => {
      Object.keys(yearData[year]).forEach(month => {
        const monthFlights = yearData[year][month];
        if (monthFlights) {
          Object.keys(monthFlights).forEach(flightKey => {
            allFlights.push({
              ...monthFlights[flightKey],
              id: parseInt(flightKey)
            });
          });
        }
      });
    });
    
    callback(allFlights.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
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
