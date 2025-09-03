import * as XLSX from 'xlsx';
import { Flight, CrewMember } from '../types';

// Excel 파일에서 비행 데이터를 추출하고 정리하는 함수
export const parseExcelFile = (file: File): Promise<Flight[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 첫 번째 시트 사용
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // JSON으로 변환
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        

        
        // 4번째 행에서 DUTY 정보 추출 (월별 총 BLOCK 시간)
        let monthlyTotalBlock = 0;
        const dutyRow = jsonData[3] as any[];
        if (Array.isArray(dutyRow)) {
          dutyRow.forEach((cell, colIndex) => {
            if (cell && typeof cell === 'string' && cell.toUpperCase().includes('DUTY')) {
              const dutyMatch = cell.match(/DUTY\s*:\s*(\d{1,2}):(\d{2})/i);
              if (dutyMatch) {
                const hours = parseInt(dutyMatch[1]);
                const minutes = parseInt(dutyMatch[2]);
                monthlyTotalBlock = hours + (minutes / 60);

              }
            }
          });
        }
        
        // 5번째 행부터 데이터 추출 (해당 월의 말일까지)
        const dataRows = jsonData.slice(4) as any[][];

        
        // 해당 월의 말일까지 필터링
        const currentMonth = new Date().getMonth() + 1; // 1-12
        const currentYear = new Date().getFullYear();
        const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();
        
        // 비행 데이터를 stateful하게 파싱하고 병합
        const flightsMap = new Map<string, Flight>();
        let lastFlightKey: string | null = null;
        let lastDate: string = new Date().toISOString().split('T')[0];
 
        dataRows.forEach((row, index) => {
            // 빈 행 건너뛰기
            if (row.length === 0 || !row.some(cell => cell)) {
                return;
            }
 
            const dateStr = row[0] ? String(row[0]).trim() : '';
            let flightNumber = row[2] ? String(row[2]).trim() : '';
            let route = row[8] ? String(row[8]).trim() : '';
            const std = row[10] ? String(row[10]).trim() : '';
            const sta = row[11] ? String(row[11]).trim() : '';
 
            // STANDBY 정보 축약
            if (flightNumber.includes('A-TYPE STANDBY')) {
               flightNumber = 'A STBY';
            } else if (flightNumber.includes('B-TYPE STANDBY')) {
               flightNumber = 'B STBY';
            }
            if (route.includes('A-TYPE STANDBY')) {
               route = 'A STBY';
            } else if (route.includes('B-TYPE STANDBY')) {
               route = 'B STBY';
            }

            // Crew 정보 파싱
            const crewMember: CrewMember = {
                empl: row[12] ? String(row[12]).trim() : '',
                name: row[13] ? String(row[13]).trim() : '',
                rank: row[15] ? String(row[15]).trim() : '',
                posnType: row[18] ? String(row[18]).trim() : '',
                posn: row[19] ? String(row[19]).trim() : ''
            };
            const hasCrewInfo = !!(crewMember.empl || crewMember.name);
 
            // 날짜 파싱 및 유지
            const dateMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\([월화수목금토일]\)$/);
            if (dateMatch) {
                const month = parseInt(dateMatch[1]);
                const day = parseInt(dateMatch[2]);
                lastDate = `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            }
 
            const isFlightRow = flightNumber && flightNumber !== 'FLIGHT' && !flightNumber.includes('DAY OFF');
            const isSpecialScheduleRow = !isFlightRow && route && (route.includes('STANDBY') || route.includes('FIXED SKD'));
 
            // 비행편 정보가 있는 행 (신기록 또는 특별 스케줄)
            if (isFlightRow || isSpecialScheduleRow) {
                lastFlightKey = `${lastDate}-${flightNumber || route}`; // STANDBY 등을 위해 route도 키로 사용
 
                const newFlight: Flight = {
                    id: Math.floor(Math.random() * 1000000) + index,
                    date: lastDate,
                    flightNumber: flightNumber,
                    route: route,
                    std: formatTime(std),
                    sta: formatTime(sta),
                    block: 0,
                    status: { departed: false, landed: false },
                    crew: []
                };
                
                if (hasCrewInfo) {
                    newFlight.crew.push(crewMember);
                }
                
                flightsMap.set(lastFlightKey, newFlight);
                
            }
            // Crew 정보만 있는 행
            else if (hasCrewInfo && lastFlightKey) {
                const existingFlight = flightsMap.get(lastFlightKey);
                if (existingFlight) {
                    existingFlight.crew.push(crewMember);

                }
            }
        });
 
        // DAY OFF 같은 유효하지 않은 항목 필터링 (이미 위에서 처리했지만 안전장치)
        const flights = Array.from(flightsMap.values()).filter(flight => {
            const isDayOff = flight.flightNumber.includes('DAY OFF');
            return !isDayOff;
        });
 
        // 월별 총 BLOCK 시간 정보를 첫 번째 비행 데이터에 추가
        if (flights.length > 0 && monthlyTotalBlock > 0) {
          flights[0].monthlyTotalBlock = monthlyTotalBlock;

        }
        resolve(flights);
      } catch (error) {
        console.error('Excel 파싱 오류:', error);
        reject(new Error('Excel 파일 파싱에 실패했습니다: ' + error));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('파일 읽기에 실패했습니다.'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};

// 헤더에 따라 값을 가져오는 헬퍼 함수 (안전한 처리)
const getValueByHeader = (headers: string[], row: any[], targetHeader: string): string => {
  const index = headers.findIndex(header => 
    header && header.toString().toUpperCase() === targetHeader.toUpperCase()
  );
  if (index !== -1 && row[index] !== null && row[index] !== undefined) {
    return String(row[index]).trim();
  }
  return '';
};

// Block 시간을 파싱하는 함수 (예: "03:30" -> 3.5, "2:45" -> 2.75)
const parseBlockTime = (value: any): number => {
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    // "HH:MM" 형식 파싱
    const timeMatch = value.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      return hours + (minutes / 60);
    }
    
    // 숫자로 변환 시도
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      return numValue;
    }
  }
  
  return 0;
};

// 시간 형식 변환 함수
const formatTime = (value: any): string => {
  if (typeof value === 'string') {
    // "HH:MM" 형식 확인
    const timeMatch = value.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      return value;
    }
    
    // "DD HH:MM" 형식 파싱 (예: "04 09:40")
    const dayTimeMatch = value.match(/^(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
    if (dayTimeMatch) {
      const day = parseInt(dayTimeMatch[1]);
      const hours = parseInt(dayTimeMatch[2]);
      const minutes = parseInt(dayTimeMatch[3]);
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    
    // 숫자로 변환 시도 (Excel 시간 형식)
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      const hours = Math.floor(numValue * 24);
      const minutes = Math.floor((numValue * 24 - hours) * 60);
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }
  
  return String(value);
};

// 날짜 형식 변환 함수
const formatDate = (value: any): string => {
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  
  if (typeof value === 'string') {
    // "MM/DD(요일)" 형식 파싱 (예: "08/01(금)")
    const dateMatch = value.match(/^(\d{1,2})\/(\d{1,2})\([월화수목금토일]\)$/);
    if (dateMatch) {
      const month = parseInt(dateMatch[1]);
      const day = parseInt(dateMatch[2]);
      const year = new Date().getFullYear();
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
    
    // 다양한 날짜 형식 처리
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  if (typeof value === 'number') {
    // Excel 날짜 숫자를 Date로 변환
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  // 기본값: 오늘 날짜
  return new Date().toISOString().split('T')[0];
};
