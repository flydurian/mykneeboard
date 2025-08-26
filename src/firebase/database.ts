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
    const dataRef = ref(database, path);
    const newRef = push(dataRef);
    await set(newRef, data);
    return newRef.key;
  } catch (error) {
    console.error("Error pushing data:", error);
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

// 월별 데이터 경로 생성 함수
const getMonthPath = (date: string) => {
  const dateObj = new Date(date);
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1; // 0-based to 1-based
  return `flights/${year}/${month.toString().padStart(2, '0')}`;
};

// 모든 월의 비행 데이터 가져오기
export const getAllFlights = async () => {
  try {
    const allFlightsRef = ref(database, 'flights');
    const snapshot = await get(allFlightsRef);
    if (!snapshot.exists()) return [];
    
    const allFlights: any[] = [];
    const yearData = snapshot.val();
    
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
    
    return allFlights.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } catch (error) {
    console.error('Error getting all flights:', error);
    return [];
  }
};

// 특정 월의 비행 데이터 가져오기
export const getFlightsByMonth = async (year: number, month: number) => {
  const monthPath = `flights/${year}/${month.toString().padStart(2, '0')}`;
  return await readData(monthPath);
};

// 비행 데이터 추가 (월별로 자동 분류)
export const addFlight = async (flightData: any) => {
  const monthPath = getMonthPath(flightData.date);
  return await pushData(monthPath, flightData);
};

// 비행 데이터 업데이트
export const updateFlight = async (flightId: string, flightData: any) => {
  const monthPath = getMonthPath(flightData.date);
  return await updateData(`${monthPath}/${flightId}`, flightData);
};

// 비행 데이터 삭제
export const deleteFlight = async (flightId: string, date: string) => {
  const monthPath = getMonthPath(date);
  return await deleteData(`${monthPath}/${flightId}`);
};

// 모든 월의 실시간 구독
export const subscribeToAllFlights = (callback: (flights: any[]) => void) => {
  const allFlightsRef = ref(database, 'flights');
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

// 특정 월의 실시간 구독
export const subscribeToFlightsByMonth = (year: number, month: number, callback: (flights: any) => void) => {
  const monthPath = `flights/${year}/${month.toString().padStart(2, '0')}`;
  return subscribeToData(monthPath, callback);
};

// 기존 함수들 (하위 호환성을 위해 유지)
export const getFlights = async () => {
  return await getAllFlights();
};

export const subscribeToFlights = (callback: (flights: any) => void) => {
  return subscribeToAllFlights(callback);
};
