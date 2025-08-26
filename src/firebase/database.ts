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

// 비행 데이터 관련 함수들
export const getFlights = async () => {
  return await readData('flights');
};

export const addFlight = async (flightData: any) => {
  return await pushData('flights', flightData);
};

export const updateFlight = async (flightId: string, flightData: any) => {
  return await updateData(`flights/${flightId}`, flightData);
};

export const deleteFlight = async (flightId: string) => {
  return await deleteData(`flights/${flightId}`);
};

export const subscribeToFlights = (callback: (flights: any) => void) => {
  return subscribeToData('flights', callback);
};
