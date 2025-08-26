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
        
        console.log('Excel 헤더:', jsonData[1]); // 2번째 행이 헤더
        console.log('총 행 수:', jsonData.length);
        
        // 헤더는 2번째 행 (인덱스 1), 데이터는 3번째 행부터 (인덱스 2부터)
        const headers = jsonData[1] as string[];
        const rows = jsonData.slice(2) as any[][];
        
        // DUTY 정보 찾기 (월별 총 BLOCK 시간)
        let monthlyTotalBlock = 0;
        jsonData.forEach((row, rowIndex) => {
          if (Array.isArray(row)) {
            row.forEach((cell, colIndex) => {
              if (cell && typeof cell === 'string' && cell.toUpperCase().includes('DUTY')) {
                const dutyMatch = cell.match(/DUTY\s*:\s*(\d{1,2}):(\d{2})/i);
                if (dutyMatch) {
                  const hours = parseInt(dutyMatch[1]);
                  const minutes = parseInt(dutyMatch[2]);
                  monthlyTotalBlock = hours + (minutes / 60);
                  console.log(`DUTY 정보 발견 (행 ${rowIndex + 1}): ${hours}:${minutes} (${monthlyTotalBlock}시간)`);
                }
              }
            });
          }
        });
        
        // 비행 데이터로 변환 및 정리
        const flights: Flight[] = rows
          .filter(row => row.length > 0 && row.some(cell => cell !== null && cell !== undefined))
          .filter(row => {
            // DUTY 정보가 포함된 행은 제외
            return !row.some(cell => cell && typeof cell === 'string' && cell.toUpperCase().includes('DUTY'));
          })
          .map((row, index) => {
            console.log(`행 ${index + 3} 처리:`, row); // 실제 행 번호는 3부터 시작
            
            // 기본값 설정
            const defaultFlight: Flight = {
              id: Date.now() + index, // 고유 ID 생성
              date: new Date().toISOString().split('T')[0], // 오늘 날짜
              flightNumber: '',
              route: '',
              std: '',
              sta: '',
              block: 0,
              status: {
                departed: false,
                landed: false
              },
              crew: []
            };

            // 헤더에 따라 데이터 매핑 (안전한 처리)
            headers.forEach((header, colIndex) => {
              const value = row[colIndex];
              if (value !== null && value !== undefined && header) {
                const headerUpper = header.toString().toUpperCase();
                
                if (headerUpper === 'DATE') {
                  const formattedDate = formatDate(value);
                  defaultFlight.date = formattedDate;
                  console.log(`날짜 매핑: ${value} -> ${formattedDate}`);
                } else if (headerUpper === 'FLIGHT') {
                  defaultFlight.flightNumber = String(value).trim();
                  console.log(`항공편 매핑: ${value}`);
                } else if (headerUpper === 'SECTOR') {
                  defaultFlight.route = String(value).trim();
                  console.log(`구간 매핑: ${value}`);
                } else if (headerUpper === 'STD') {
                  defaultFlight.std = formatTime(value);
                  console.log(`출발시간 매핑: ${value} -> ${defaultFlight.std}`);
                } else if (headerUpper === 'STA') {
                  defaultFlight.sta = formatTime(value);
                  console.log(`도착시간 매핑: ${value} -> ${defaultFlight.sta}`);
                } else if (headerUpper.includes('BLOCK')) {
                  // Block 시간을 시간 형식으로 파싱 (예: "03:30" -> 3.5)
                  const blockTime = parseBlockTime(value);
                  defaultFlight.block = blockTime;
                  console.log(`블록시간 매핑: ${value} -> ${blockTime}시간`);
                }
              }
            });

            // Crew 정보 추가 (EMPL, NAME, RANK, POSN TYP, POSN)
            const crewMember: CrewMember = {
              empl: getValueByHeader(headers, row, 'EMPL') || '',
              name: getValueByHeader(headers, row, 'NAME') || '',
              rank: getValueByHeader(headers, row, 'RANK') || '',
              posnType: getValueByHeader(headers, row, 'POSN \nTYP') || getValueByHeader(headers, row, 'POSN TYP') || '',
              posn: getValueByHeader(headers, row, 'POSN') || ''
            };
            
            defaultFlight.crew = [crewMember];
            
            console.log(`비행 데이터 생성 완료:`, {
              date: defaultFlight.date,
              flightNumber: defaultFlight.flightNumber,
              route: defaultFlight.route,
              std: defaultFlight.std,
              sta: defaultFlight.sta,
              block: defaultFlight.block,
              crew: crewMember
            });

            return defaultFlight;
          })
          .filter(flight => {
            // 유효한 비행 데이터만 필터링 (항공편 번호가 있거나 특별한 일정인 경우)
            const hasFlightNumber = flight.flightNumber && flight.flightNumber.trim() !== '';
            const hasSpecialSchedule = flight.route && (
              flight.route.includes('DAY OFF') || 
              flight.route.includes('STANDBY') || 
              flight.route.includes('FIXED SKD')
            );
            const isValid = hasFlightNumber || hasSpecialSchedule;
            
            if (!isValid) {
              console.log(`유효하지 않은 비행 데이터 제외:`, flight);
            } else {
              console.log(`유효한 비행 데이터 포함:`, flight);
            }
            return isValid;
          });

        // 월별 총 BLOCK 시간 정보를 첫 번째 비행 데이터에 추가
        if (flights.length > 0 && monthlyTotalBlock > 0) {
          flights[0].monthlyTotalBlock = monthlyTotalBlock;
          console.log(`월별 총 블록시간 추가: ${monthlyTotalBlock}시간`);
        }

        console.log(`최종 처리된 비행 데이터: ${flights.length}개`);
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
