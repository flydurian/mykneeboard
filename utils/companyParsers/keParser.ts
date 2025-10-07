import { Flight, CrewMember } from '../../types';
import { fromZonedTime, format } from 'date-fns-tz';
import { getTimezone } from '../cityData';

// STD/STA 날짜와 시간을 파싱하는 함수
const parseDateTime = (value: string, baseDate: string): { date: string, time: string } => {
  if (typeof value === 'string') {
    // "DD HH:MM" 형식 파싱 (예: "10 20:05")
    const dayTimeMatch = value.match(/^(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
    if (dayTimeMatch) {
      const day = parseInt(dayTimeMatch[1]);
      const hours = parseInt(dayTimeMatch[2]);
      const minutes = parseInt(dayTimeMatch[3]);
      
      // 기본 날짜에서 년월일 추출 (문자열 직접 파싱)
      const [yearStr, monthStr, dayStr] = baseDate.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      const baseDay = parseInt(dayStr);
      
      // 날짜가 기준일보다 작으면 다음달로 처리
      let targetMonth = month;
      let targetYear = year;
      
      if (day < baseDay) {
        targetMonth = month + 1;
        if (targetMonth > 12) {
          targetMonth = 1;
          targetYear = year + 1;
        }
      }
      
      // 날짜 생성
      const date = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      return { date, time };
    }
    
    // "HH:MM" 형식 (날짜 정보 없음)
    const timeMatch = value.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      return { date: baseDate, time };
    }
  }
  
  // 유효하지 않은 값인 경우 기본값 반환
  if (!value || value === '' || value === 'undefined' || value === 'null') {
    return { date: baseDate, time: '00:00' };
  }
  
  return { date: baseDate, time: String(value) };
};

// Show Up 시간을 계산하는 함수 (한국 공항 출발 시, 출발시간에서 1시간 20분 빼기)
const calculateShowUpTime = (departureDate: string, departureTime: string, route: string): string | undefined => {
  try {
    const [depAirport] = route.split('/');
    
    // 한국 공항 목록을 만들어 출발 공항이 포함되는지 확인
    const koreanAirports = ['ICN', 'GMP', 'PUS', 'CJU', 'TAE', 'CJJ']; // 주요 국내 공항 리스트
    
    if (!depAirport || !koreanAirports.includes(depAirport.toUpperCase())) {
      return undefined; // 한국 공항 출발이 아닌 경우 Show Up 시간 없음
    }

    const depTz = getTimezone(depAirport);
    if (!depTz) {
      return undefined;
    }

    // 출발 시간을 현지시간으로 생성하고 UTC로 변환
    const departureDateTimeString = `${departureDate}T${departureTime}`;
    const departureUtc = fromZonedTime(departureDateTimeString, depTz);
    
    // Show Up 시간 계산 (1시간 20분 = 80분 빼기)
    const showUpUtc = new Date(departureUtc.getTime() - 80 * 60 * 1000);
    
    return showUpUtc.toISOString();
  } catch (error) {
    console.error('Show Up 시간 계산 오류:', error);
    return undefined;
  }
};

// 현지시간을 UTC로 변환하는 함수
const convertLocalTimeToUTC = (departureDate: string, departureTime: string, arrivalDate: string, arrivalTime: string, route: string): {
  departureDateTimeUtc?: string,
  arrivalDateTimeUtc?: string
} => {
  try {
    if (!departureTime || !arrivalTime || !route) {
      return { departureDateTimeUtc: undefined, arrivalDateTimeUtc: undefined };
    }

    const [depAirport, arrAirport] = route.split('/');
    const depTz = getTimezone(depAirport);
    const arrTz = getTimezone(arrAirport);

    if (!depTz || !arrTz) {
      console.error(`⚠️ 시간대 정보를 찾을 수 없습니다: ${route}`);
      return { departureDateTimeUtc: undefined, arrivalDateTimeUtc: undefined };
    }

    // 출발 시간을 현지시간으로 생성하고 UTC로 변환
    const departureDateTimeString = `${departureDate}T${departureTime}`;
    const departureUtc = fromZonedTime(departureDateTimeString, depTz);

    // 도착 시간을 현지시간으로 생성하고 UTC로 변환
    const arrivalDateTimeString = `${arrivalDate}T${arrivalTime}`;
    const arrivalUtc = fromZonedTime(arrivalDateTimeString, arrTz);

    return {
      departureDateTimeUtc: departureUtc.toISOString(),
      arrivalDateTimeUtc: arrivalUtc.toISOString()
    };
  } catch (error) {
    console.error('시간 변환 오류:', error);
    return { departureDateTimeUtc: undefined, arrivalDateTimeUtc: undefined };
  }
};

// 대한항공(KE) 전용 엑셀 파싱 함수
export const parseKEExcel = (jsonData: any[][], userName?: string, empl?: string): { flights: Flight[], monthlyTotalBlock: string, scheduleMonth?: number, scheduleYear?: number } => {
  
  // 헤더 행 찾기 (Date, Pairing/Activity, Dep Stn / Dep Time, Arr Stn / Arr Time 등)
  let headerRowIndex = -1;
  let dateColIndex = -1;
  let pairingColIndex = -1;
  let itemColIndex = -1;
  let depStnTimeColIndex = -1;
  let arrStnTimeColIndex = -1;
  let fhColIndex = -1;
  let acTypeColIndex = -1;
  
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (Array.isArray(row)) {
      const rowStr = row.join(' ').toLowerCase();
      
      // 더 유연한 헤더 감지
      if (rowStr.includes('date') && (rowStr.includes('pairing') || rowStr.includes('activity')) && rowStr.includes('dep')) {
        headerRowIndex = i;
        
        // 각 컬럼 인덱스 찾기
        row.forEach((cell, colIndex) => {
          const cellStr = String(cell).toLowerCase().trim();
          
          if (cellStr === 'date' || (cellStr.includes('date') && !cellStr.includes('updated'))) {
            dateColIndex = colIndex;
          }
          else if (cellStr.includes('pairing') && cellStr.includes('activity')) {
            pairingColIndex = colIndex;
          }
          else if (cellStr.includes('item')) {
            itemColIndex = colIndex;
          }
          else if (cellStr.includes('dep stn') && cellStr.includes('dep time')) {
            depStnTimeColIndex = colIndex;
          }
          else if (cellStr.includes('arr stn') && cellStr.includes('arr time')) {
            arrStnTimeColIndex = colIndex;
          }
          // 더 유연한 Arr 컬럼 감지
          else if (cellStr.includes('arr') && cellStr.includes('time')) {
            arrStnTimeColIndex = colIndex;
          }
          // FH (Flying Hours) 컬럼 감지
          else if (cellStr.includes('flying hrs') || cellStr === 'fh') {
            fhColIndex = colIndex;
          }
          // A/C Type 컬럼 감지
          else if (cellStr.includes('a/c type') || cellStr.includes('ac type') || cellStr === 'a/c') {
            acTypeColIndex = colIndex;
          }
        });
        break;
      }
    }
  }
  
  if (headerRowIndex === -1) {
    console.error('KE 엑셀 헤더를 찾을 수 없습니다.');
    return { flights: [], monthlyTotalBlock: '00:00' };
  }
  
  
  // 엑셀에서 사용자 이름 찾기
  let foundUserName = '';
  let foundEmpl = '';
  let foundRank = 'PILOT'; // 기본값
  
  try {
    // 1. J1:S1 위치에서 승무원 정보 파싱 (우선순위 1)
    if (jsonData[0] && jsonData[0].length > 9) { // J열은 인덱스 9 (0-based)
      const j1ToS1Data = jsonData[0].slice(9, 19); // J1:S1 (인덱스 9-18)
      
      // 파이프(|)로 구분된 데이터 찾기
      for (let i = 0; i < j1ToS1Data.length; i++) {
        const cellValue = String(j1ToS1Data[i]).trim();
        if (cellValue.includes('|')) {
          const parts = cellValue.split('|').map(part => part.trim());
          
          if (parts.length >= 5) {
            // JAEKYU LEE | 1702142 | 330 | ICN | FO
            // 첫번째: 이름, 두번째: EMPL, 다섯번째: RANK
            foundUserName = parts[0];
            foundEmpl = parts[1];
            foundRank = parts[4];
            break;
          }
        }
      }
    }
    
    // 2. J1:S1에서 찾지 못한 경우 엑셀 전체에서 검색 (우선순위 2)
    if (!foundUserName || !foundEmpl) {
      for (let i = 0; i < jsonData.length; i++) {
        for (let j = 0; j < jsonData[i].length; j++) {
          const cellValue = String(jsonData[i][j]).trim();
          
          // EMPL ID가 전달되었고, 엑셀에서 해당 EMPL ID를 찾은 경우
          if (empl && cellValue.includes(empl)) {
            foundEmpl = empl;
            
            // 같은 행에서 이름 정보 찾기
            const row = jsonData[i];
            for (let k = 0; k < row.length; k++) {
              const nameCell = String(row[k]).trim();
              // 한글이나 영문 이름 패턴 찾기 (EMPL ID가 아닌 경우)
              if (nameCell && nameCell !== empl && nameCell.length > 1 && 
                  (nameCell.match(/[가-힣]{2,4}/) || nameCell.match(/[A-Za-z]{2,10}/))) {
                foundUserName = nameCell;
                break;
              }
            }
            break;
          }
          
          // 사용자 이름이 전달되었고, 엑셀에서 해당 이름을 찾은 경우
          if (userName && cellValue.includes(userName)) {
            foundUserName = userName;
            break;
          }
        }
        if (foundUserName || foundEmpl) break;
      }
    }
    
    // 3. 전달받은 정보를 우선적으로 사용 (회원가입 시 입력한 정보) - 우선순위 3
    // 암호화된 데이터인지 확인 (Base64 패턴 체크)
    const isEncryptedData = (str: string) => {
      return /^[A-Za-z0-9+/=]+$/.test(str) && str.length > 20;
    };
    
    if (userName && !isEncryptedData(userName)) {
      foundUserName = userName;
    } else if (userName && isEncryptedData(userName)) {
    }
    
    if (empl && !isEncryptedData(empl)) {
      foundEmpl = empl;
    } else if (empl && isEncryptedData(empl)) {
    }
    
  } catch (error) {
    // 오류 발생 시 전달받은 정보 사용
    if (userName) foundUserName = userName;
    if (empl) foundEmpl = empl;
  }
  
  // D1:I1 위치에서 월 정보 추출
  let scheduleMonthStr = '';
  let scheduleYearStr = '';
  let scheduleMonth = 0;
  let scheduleYear = 0;
  
  try {
    // D1:I1 범위에서 월 정보 찾기 (0-based index: 0행 3-8열)
    for (let col = 3; col <= 8; col++) {
      if (jsonData[0] && jsonData[0][col]) {
        const cellValue = String(jsonData[0][col]).trim();
        
        // 월 정보가 포함된 셀 찾기 (예: "September 2025", "Sep 2025", "2025년 9월" 등)
        if (cellValue && cellValue.length > 0) {
          // 다양한 월 형식 지원
          let monthMatch = cellValue.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
          if (!monthMatch) {
            monthMatch = cellValue.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
          }
          if (!monthMatch) {
            monthMatch = cellValue.match(/(\d{4})년\s*(\d{1,2})월/i);
            if (monthMatch) {
              // 년월 순서 바꾸기
              const temp = monthMatch[1];
              monthMatch[1] = monthMatch[2];
              monthMatch[2] = temp;
            }
          }
          if (!monthMatch) {
            monthMatch = cellValue.match(/(\d{1,2})월\s*(\d{4})/i);
          }
          
          if (monthMatch) {
            scheduleMonthStr = monthMatch[1];
            scheduleYearStr = monthMatch[2];
            
            // 월 이름을 숫자로 변환
            const monthMap: { [key: string]: number } = {
              'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
              'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12,
              'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'Jun': 6,
              'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
            };
            
            scheduleMonth = monthMap[scheduleMonthStr] || parseInt(scheduleMonthStr);
            scheduleYear = parseInt(scheduleYearStr);
            
            break;
          }
        }
      }
    }
    
    if (!scheduleMonth || !scheduleYear) {
    }
  } catch (error) {
  }

  // T1:V1 위치에서 총 비행시간 추출
  let monthlyTotalBlock = '00:00';
  try {
    // T1:V1 위치를 동적으로 찾기 (20행 22열, 0-based index: 19행 21열)
    // 또는 "FH :" 텍스트가 포함된 셀을 찾기
    let totalFhCell = '';
    
    // 먼저 T1:V1 위치 확인
    if (jsonData[19] && jsonData[19][21]) {
      totalFhCell = String(jsonData[19][21]).trim();
    }
    
    // T1:V1에서 찾지 못했으면 "FH :" 텍스트가 포함된 셀을 찾기
    if (!totalFhCell || !totalFhCell.includes(':')) {
      for (let i = 0; i < jsonData.length; i++) {
        for (let j = 0; j < jsonData[i].length; j++) {
          const cellValue = String(jsonData[i][j]).trim();
          if (cellValue.includes('FH :') && cellValue.includes(':')) {
            totalFhCell = cellValue;
            break;
          }
        }
        if (totalFhCell) break;
      }
    }
    
    if (totalFhCell && totalFhCell.includes(':')) {
      const fhMatch = totalFhCell.match(/(\d{1,2}):(\d{2})/);
      if (fhMatch) {
        const hours = parseInt(fhMatch[1]);
        const minutes = parseInt(fhMatch[2]);
        monthlyTotalBlock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
    } else {
    }
  } catch (error) {
  }

  // 데이터 행들 (헤더 다음부터)
  const dataRows = jsonData.slice(headerRowIndex + 1) as any[][];
  const flights: Flight[] = [];
  
  // D1:I1에서 추출한 월 정보를 기반으로 기본 날짜 설정
  let baseYear = new Date().getFullYear();
  let baseMonth = new Date().getMonth() + 1; // 1-based
  
  if (scheduleYear && scheduleMonth) {
    baseYear = scheduleYear;
    baseMonth = scheduleMonth;
  }
  
  let lastDate: string = `${baseYear}-${baseMonth.toString().padStart(2, '0')}-01`;
  
  
  // 처음 몇 행의 데이터 구조 확인
  
  dataRows.forEach((row, index) => {
    // 빈 행 건너뛰기
    if (row.length === 0 || !row.some(cell => cell)) {
      return;
    }
    
    // 날짜 추출 (Date 컬럼)
    const dateStr = row[dateColIndex] ? String(row[dateColIndex]).trim() : '';
    
    if (dateStr && dateStr !== 'undefined' && dateStr !== 'null' && dateStr !== '' && dateStr !== '""' && dateStr !== 'Date') {
      // Excel에서 날짜가 숫자로 저장된 경우 처리 (Excel 날짜 시리얼 번호)
      if (!isNaN(Number(dateStr)) && Number(dateStr) > 40000) {
        // Excel 날짜 숫자를 실제 날짜로 변환 (1900년 기준)
        const excelDate = Number(dateStr);
        const date = new Date((excelDate - 25569) * 86400 * 1000);
        // 한국시간 기준으로 날짜 문자열 생성
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        lastDate = `${year}-${month}-${day}`;
      } else {
        // 다양한 날짜 형식 지원
        let dateMatch = dateStr.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
        if (!dateMatch) {
          // 다른 형식도 시도
          dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (!dateMatch) {
            dateMatch = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
          }
        }
        
        if (dateMatch) {
          let day, month, year;
          
          if (dateStr.includes('-') && (dateStr.includes('Sep') || dateStr.includes('Oct') || dateStr.includes('Jan') || dateStr.includes('Feb') || dateStr.includes('Mar') || dateStr.includes('Apr') || dateStr.includes('May') || dateStr.includes('Jun') || dateStr.includes('Jul') || dateStr.includes('Aug') || dateStr.includes('Nov') || dateStr.includes('Dec'))) {
            // "04-Sep-2025" 형식
            day = parseInt(dateMatch[1]);
            const monthStr = dateMatch[2];
            year = parseInt(dateMatch[3]);
            
            
            // 월 이름을 숫자로 변환
            const monthMap: { [key: string]: number } = {
              'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
              'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
            };
            month = monthMap[monthStr] || 1;
            
          } else if (dateStr.includes('/')) {
            // "01/09/2025" 형식
            day = parseInt(dateMatch[1]);
            month = parseInt(dateMatch[2]);
            year = parseInt(dateMatch[3]);
          } else {
            // "2025-09-01" 형식
            year = parseInt(dateMatch[1]);
            month = parseInt(dateMatch[2]);
            day = parseInt(dateMatch[3]);
          }
          
          lastDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        } else {
        }
      }
    } else {
      // 날짜가 비어있으면 이전 날짜를 유지 (같은 날짜의 연속된 비행편 처리)
      // 단, 첫 번째 행이거나 이전 날짜가 없을 때만 새 날짜 생성
      if (index === 0 || !lastDate) {
        // 첫 번째 행이거나 이전 날짜가 없으면 1일로 설정
        lastDate = `${baseYear}-${baseMonth.toString().padStart(2, '0')}-01`;
      } else {
        // 날짜가 비어있으면 이전 날짜 유지 (같은 날짜의 연속된 비행편)
      }
    }
    
    // Pairing/Activity 추출 (따옴표 제거)
    let pairingStr = row[pairingColIndex] ? String(row[pairingColIndex]).trim() : '';
    pairingStr = pairingStr.replace(/"/g, '');
    
    let itemStr = row[itemColIndex] ? String(row[itemColIndex]).trim() : '';
    itemStr = itemStr.replace(/"/g, '');
    
    // Dep Stn / Dep Time 추출 (따옴표 제거)
    let depStnTimeStr = row[depStnTimeColIndex] ? String(row[depStnTimeColIndex]).trim() : '';
    depStnTimeStr = depStnTimeStr.replace(/"/g, '');
    
    // Arr Stn / Arr Time 추출 (따옴표 제거)
    let arrStnTimeStr = row[arrStnTimeColIndex] ? String(row[arrStnTimeColIndex]).trim() : '';
    arrStnTimeStr = arrStnTimeStr.replace(/"/g, '');
    
    // FH (Flying Hours) 추출 (따옴표 제거)
    let fhStr = row[fhColIndex] ? String(row[fhColIndex]).trim() : '';
    fhStr = fhStr.replace(/"/g, '');
    // A/C Type 추출 (따옴표 제거)
    let acTypeStr = row[acTypeColIndex] ? String(row[acTypeColIndex]).trim() : '';
    acTypeStr = acTypeStr.replace(/"/g, '');
    
    
    let flightNumber = '';
    let route = '';
    let std = '';
    let sta = '';
    let block = 0;
    let scheduleType = 'FLIGHT';
    
    // FH (Flying Hours) 파싱 - "01:12" 형식을 분 단위로 변환
    if (fhStr && fhStr !== '') {
      const fhMatch = fhStr.match(/(\d{1,2}):(\d{2})/);
      if (fhMatch) {
        const hours = parseInt(fhMatch[1]);
        const minutes = parseInt(fhMatch[2]);
        block = hours * 60 + minutes; // 분 단위로 변환
      }
    }
    
    // DO (Day Off) 처리 - 표시하지 않음
    if (pairingStr.includes('DO') || itemStr.includes('DO')) {
      return; // DO는 건너뛰기
    }
    
    // ALV, ALM (Annual Leave) 처리 - 휴가스케줄로 파싱
    if (pairingStr.includes('ALV') || itemStr.includes('ALV') || pairingStr.includes('ALM') || itemStr.includes('ALM')) {
      
      // ALV 또는 ALM 중 어느 것을 사용할지 결정
      const leaveType = pairingStr.includes('ALM') || itemStr.includes('ALM') ? 'ALM' : 'ALV';
      
      flightNumber = leaveType;
      route = '';
      std = '';
      sta = '';
      scheduleType = 'ANNUAL_LEAVE';
      // 휴가는 A/C TYPE 정보 없음
      acTypeStr = '';
      
    }
    
    // RDO (Reserve Day Off) 처리 - RDO로만 표시, STD/STA 없음
    if (pairingStr.includes('RDO') || itemStr.includes('RDO')) {
      flightNumber = 'RDO';
      route = 'RDO'; // 빈 문자열에서 'RDO'로 변경
      std = '';
      sta = '';
      scheduleType = 'RDO';
      // RDO는 A/C TYPE 정보 없음
      acTypeStr = '';
    }
    // RESERVE 처리 - RESERVE로 표시, STD/STA 없음
    else if (pairingStr.includes('RESERVE') || itemStr.includes('RESERVE')) {
      flightNumber = 'RESERVE';
      route = '';
      std = '';
      sta = '';
      scheduleType = 'STANDBY';
      // RESERVE는 A/C TYPE 정보 없음
      acTypeStr = '';
    }
    // STBY 처리 - 다양한 STBY 패턴 지원
    else if (pairingStr.includes('STBY') || itemStr.includes('STBY') || 
             pairingStr.includes('STANDBY') || itemStr.includes('STANDBY')) {
      flightNumber = 'STBY';
      route = 'STBY';
      std = '';
      sta = '';
      scheduleType = 'STANDBY';
      // STBY는 A/C TYPE 정보 없음
      acTypeStr = '';
    }
    // HM_SBY 처리 - OTHRDUTY와 같은 로직으로 도시명과 시간 표시
    else if (pairingStr.includes('HM_SBY') || itemStr.includes('HM_SBY')) {
      
      // Dep Stn에서 도시 추출 ("ICN 15:59" 형식에서 도시만)
      const depCityMatch = depStnTimeStr.match(/^([A-Z]{3})\s+/);
      if (depCityMatch) {
        route = depCityMatch[1];
      } else {
        route = 'STBY';
      }
      flightNumber = 'HM SBY';
      scheduleType = 'STANDBY';
      
      // HM SBY는 A/C TYPE 정보 없음
      acTypeStr = '';
      
      // STD/STA 시간 추출 (도시 정보 제외하고 시간만) - "ICN 15:59" 형식
      const depTimeMatch = depStnTimeStr.match(/\s+(\d{1,2}):(\d{2})/);
      if (depTimeMatch) {
        std = `${depTimeMatch[1].padStart(2, '0')}:${depTimeMatch[2]}`;
      }
      
      // Arr. Stn / Arr. Time이 비어있으면 Dep. Stn / Dep. Time의 시간을 STA로 사용
      const arrTimeMatch = arrStnTimeStr.match(/\s+(\d{1,2}):(\d{2})/);
      if (arrTimeMatch) {
        sta = `${arrTimeMatch[1].padStart(2, '0')}:${arrTimeMatch[2]}`;
      } else if (depTimeMatch) {
        // Arr. Stn / Arr. Time이 비어있으면 Dep. Stn / Dep. Time의 시간을 STA로 사용
        sta = `${depTimeMatch[1].padStart(2, '0')}:${depTimeMatch[2]}`;
      }
      
      
    }
    // OTHRDUTY 처리 - 도시명만 표시, STD/STA 표시
    else if (pairingStr.includes('OTHRDUTY') || itemStr.includes('OTHRDUTY')) {
      // Dep Stn에서 도시 추출 ("GMP 08:30" 형식에서 도시만)
      const depCityMatch = depStnTimeStr.match(/^([A-Z]{3})\s+/);
      if (depCityMatch) {
        route = depCityMatch[1];
      } else {
        route = 'OTHRDUTY';
      }
      flightNumber = 'OTHRDUTY';
      scheduleType = 'STANDBY';
      
      // OTHRDUTY는 A/C TYPE 정보 없음
      acTypeStr = '';
      
      // STD/STA 시간 추출 (도시 정보 제외하고 시간만)
      const depTimeMatch = depStnTimeStr.match(/\s+(\d{1,2}):(\d{2})/);
      if (depTimeMatch) {
        std = `${depTimeMatch[1].padStart(2, '0')}:${depTimeMatch[2]}`;
      }
      
      // Arr. Stn / Arr. Time이 비어있으면 Dep. Stn / Dep. Time의 시간을 STA로 사용
      const arrTimeMatch = arrStnTimeStr.match(/\s+(\d{1,2}):(\d{2})/);
      if (arrTimeMatch) {
        sta = `${arrTimeMatch[1].padStart(2, '0')}:${arrTimeMatch[2]}`;
      } else if (depTimeMatch) {
        // Arr. Stn / Arr. Time이 비어있으면 Dep. Stn / Dep. Time의 시간을 STA로 사용
        sta = `${depTimeMatch[1].padStart(2, '0')}:${depTimeMatch[2]}`;
      }
      
      
      
    }
    // 정상 비행편 처리 - Item 컬럼에서 KE 편명을 찾음
    else if (itemStr.includes('KE')) {
      // 편명 추출 - Item 컬럼에서 KE 편명 추출
      const flightMatch = itemStr.match(/KE(\d{3,4})/);
      
      if (flightMatch) {
        flightNumber = flightMatch[1]; // KE 제외하고 숫자만
      }
      
      // 노선 정보 추출 (Dep Stn / Arr Stn)
      // "ICN 08:40" 형식에서 도시 코드만 추출
      const depCityMatch = depStnTimeStr.match(/^([A-Z]{3})\s+/);
      const arrCityMatch = arrStnTimeStr.match(/^([A-Z]{3})\s+/);
      
      if (depCityMatch && arrCityMatch) {
        route = `${depCityMatch[1]}/${arrCityMatch[1]}`;
      }
      
      // STD/STA 시간 추출 (도시 정보 제외하고 시간만)
      // "ICN 08:40" 형식에서 시간 부분만 추출
      const depTimeMatch = depStnTimeStr.match(/\s+(\d{1,2}):(\d{2})/);
      if (depTimeMatch) {
        std = `${depTimeMatch[1].padStart(2, '0')}:${depTimeMatch[2]}`;
      }
      
      const arrTimeMatch = arrStnTimeStr.match(/\s+(\d{1,2}):(\d{2})/);
      if (arrTimeMatch) {
        sta = `${arrTimeMatch[1].padStart(2, '0')}:${arrTimeMatch[2]}`;
      }
    }
    
    // 유효한 스케줄이 있는 경우에만 추가
    
    // flightNumber가 있고, route가 있거나 특별 스케줄인 경우 추가
    if (flightNumber && (route || scheduleType !== 'FLIGHT')) {
      // Crew 정보 설정 - J1:S1에서 파싱한 정보를 우선 사용 (평문으로 저장)
      const crew: CrewMember[] = [];
      
      // 암호화된 데이터인지 확인하는 함수
      const isEncryptedData = (str: string) => {
        return /^[A-Za-z0-9+/=]+$/.test(str) && str.length > 20;
      };
      
      // J1:S1에서 파싱한 정보가 있으면 사용 (이미 평문)
      let crewName = '';
      let crewEmpl = '';
      
      // J1:S1에서 파싱한 정보 우선 사용
      if (foundUserName && !isEncryptedData(foundUserName)) {
        crewName = foundUserName;
        crewEmpl = foundEmpl || '';
      }
      // J1:S1에서 파싱하지 못했고 전달받은 정보가 평문이면 사용
      else if (userName && !isEncryptedData(userName)) {
        crewName = userName;
        crewEmpl = empl || '';
      }
      // 모든 정보가 암호화되어 있으면 기본값 사용
      else {
        crewName = 'PILOT';
        crewEmpl = '';
      }
      
      if (crewName) {
        crew.push({
          empl: crewEmpl,
          name: crewName, // 항상 평문으로 저장
          rank: foundRank, // J1:S1에서 파싱한 RANK 사용
          posnType: foundRank, // RANK와 동일하게 설정
          posn: foundRank // RANK와 동일하게 설정
        });
      }
      
      // 비행 날짜의 월이 파일의 월과 일치하는지 확인
      const flightDate = new Date(lastDate);
      const flightMonth = flightDate.getMonth() + 1; // 1-based
      const flightYear = flightDate.getFullYear();
      
      // 해당 월의 스케줄에만 monthlyTotalBlock 적용
      const isFileMonthSchedule = (scheduleYear && scheduleMonth) && 
                                  (flightYear === scheduleYear && flightMonth === scheduleMonth);
      
      // STD/STA 날짜와 시간 파싱 (원본 데이터 그대로 사용)
      const stdParsed = parseDateTime(std, lastDate);
      const staParsed = parseDateTime(sta, lastDate);
      
      let departureDateTimeUtc: string | undefined;
      let arrivalDateTimeUtc: string | undefined;
      let showUpDateTimeUtc: string | undefined;
      
      // RESERVE는 시간 정보 없음
      if (flightNumber === 'RESERVE') {
        departureDateTimeUtc = undefined;
        arrivalDateTimeUtc = undefined;
        showUpDateTimeUtc = undefined;
      }
      // UTC 시간 변환 (일반 비행편인 경우)
      else if (route && route.includes('/')) {
        const utcTimes = convertLocalTimeToUTC(
          stdParsed.date, stdParsed.time, 
          staParsed.date, staParsed.time, 
          route
        );
        departureDateTimeUtc = utcTimes.departureDateTimeUtc;
        arrivalDateTimeUtc = utcTimes.arrivalDateTimeUtc;
        
        // Show Up 시간 계산 (한국 공항 출발인 경우만)
        if (departureDateTimeUtc) {
          showUpDateTimeUtc = calculateShowUpTime(stdParsed.date, stdParsed.time, route);
        }
      } else {
        // STBY, OTHRDUTY 등의 경우 한국시간을 UTC로 변환
        if (stdParsed.date && stdParsed.time && staParsed.date && staParsed.time) {
          const departureDateTimeString = `${stdParsed.date}T${stdParsed.time}`;
          const arrivalDateTimeString = `${staParsed.date}T${staParsed.time}`;
          
          const departureUtc = fromZonedTime(departureDateTimeString, 'Asia/Seoul');
          const arrivalUtc = fromZonedTime(arrivalDateTimeString, 'Asia/Seoul');
          
          departureDateTimeUtc = departureUtc.toISOString();
          arrivalDateTimeUtc = arrivalUtc.toISOString();
        }
      }

      const newFlight: Flight = {
        id: Math.floor(Math.random() * 1000000) + index,
        date: lastDate, // 기본 날짜 (출발일)
        departureDateTimeUtc, // ISO 8601 형식 출발일시 UTC
        arrivalDateTimeUtc, // ISO 8601 형식 도착일시 UTC
        flightNumber: flightNumber,
        route: route,
        block: block,
        status: { departed: false, landed: false },
        crew: crew,
        scheduleType: scheduleType,
        acType: acTypeStr || null, // A/C Type 정보 추가 (Firebase는 undefined 허용 안함)
        monthlyTotalBlock: isFileMonthSchedule ? monthlyTotalBlock : undefined // 해당 월에만 적용
      };
      
      // showUpDateTimeUtc가 undefined가 아닌 경우에만 추가
      if (showUpDateTimeUtc) {
        newFlight.showUpDateTimeUtc = showUpDateTimeUtc;
      }
      
      
      // CREW 데이터 상세 확인
      if (newFlight.crew && newFlight.crew.length > 0) {
      } else {
      }
      
      flights.push(newFlight);
    }
  });
  
  // 최종 결과 CREW 데이터 확인

  return { flights, monthlyTotalBlock, scheduleMonth, scheduleYear };
};

