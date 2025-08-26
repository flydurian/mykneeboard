import * as XLSX from 'xlsx';
import { Flight } from '../types';

// Excel 파일에서 비행 데이터를 추출하는 함수
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
        
        // 헤더 제거하고 데이터만 추출
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1) as any[][];
        
        // 비행 데이터로 변환
        const flights: Flight[] = rows
          .filter(row => row.length > 0 && row.some(cell => cell !== null && cell !== undefined))
          .map((row, index) => {
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

            // 헤더에 따라 데이터 매핑
            headers.forEach((header, colIndex) => {
              const value = row[colIndex];
              if (value !== null && value !== undefined) {
                const headerLower = header.toLowerCase();
                
                if (headerLower.includes('date') || headerLower.includes('날짜')) {
                  defaultFlight.date = formatDate(value);
                } else if (headerLower.includes('flight') || headerLower.includes('비행')) {
                  defaultFlight.flightNumber = String(value);
                } else if (headerLower.includes('route') || headerLower.includes('경로') || headerLower.includes('구간')) {
                  defaultFlight.route = String(value);
                } else if (headerLower.includes('std') || headerLower.includes('출발')) {
                  defaultFlight.std = String(value);
                } else if (headerLower.includes('sta') || headerLower.includes('도착')) {
                  defaultFlight.sta = String(value);
                } else if (headerLower.includes('block') || headerLower.includes('블록') || headerLower.includes('시간')) {
                  defaultFlight.block = parseFloat(value) || 0;
                }
              }
            });

            return defaultFlight;
          });

        resolve(flights);
      } catch (error) {
        reject(new Error('Excel 파일 파싱에 실패했습니다: ' + error));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('파일 읽기에 실패했습니다.'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};

// 날짜 형식 변환 함수
const formatDate = (value: any): string => {
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  
  if (typeof value === 'string') {
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

// Excel 템플릿 생성 함수 (선택사항)
export const generateExcelTemplate = (): void => {
  const template = [
    ['Date', 'Flight Number', 'Route', 'STD', 'STA', 'Block Time'],
    ['2024-01-15', 'KE123', 'ICN-NRT', '09:00', '12:00', '3.0'],
    ['2024-01-16', 'KE456', 'NRT-ICN', '14:00', '17:00', '3.0']
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Flight Schedule');
  
  // 파일 다운로드
  XLSX.writeFile(wb, 'flight_schedule_template.xlsx');
};
