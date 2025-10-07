import { Flight } from '../../types.js';
import { fromZonedTime, format } from 'date-fns-tz';
import { getTimezone, getAirportsByCountry } from '../cityData.js';

// 7C PDF 파일 파싱 함수
export const parse7CFile = (file: File): Promise<Flight[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      // PDF 텍스트 추출
      const text = await extractTextFromPDF(file);
      
      // 14개 컬럼 구조로 테이블 변환
      const tableData = convert7CPDFTextToTable(text);
      
      // 비행 데이터 파싱
      const flights = parse7CData(tableData);
      
      // VAC 스케줄 개수 확인
      const vacSchedules = flights.filter(f => f.flightNumber === 'VAC_R' || f.flightNumber === 'VAC');
      
      // Firebase에 저장 (OZ 파서와 동일한 방식으로 휴가/특별 스케줄 구분)
      if (flights.length > 0) {
        try {
          const { saveFlightSchedule } = await import("../../src/firebase/database");
          const { getAuth } = await import("firebase/auth");
          const auth = getAuth();
          const user = auth.currentUser;
          
          if (user) {
            for (const flight of flights) {
              // 휴가 스케줄과 특별 스케줄을 OZ 파서와 동일한 방식으로 저장
              await saveFlightSchedule(user.uid, flight);
            }
          } else {
            console.warn('사용자가 인증되지 않았습니다. Firebase 저장을 건너뜁니다.');
          }
        } catch (saveError) {
          console.error('7C PDF Firebase 저장 오류:', saveError);
          // 저장 실패해도 파싱된 데이터는 반환
        }
      }
      
      resolve(flights);
      
    } catch (error) {
      console.error('7C PDF 파싱 오류:', error);
      reject(new Error(`7C PDF 파일 파싱에 실패했습니다: ${error}`));
    }
  });
};

// PDF에서 텍스트 추출하는 함수 (기존 로직 사용)
const extractTextFromPDF = async (file: File): Promise<string> => {
  // 기존 PDF 텍스트 추출 로직 사용
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const pdf = await import('pdfjs-dist');
        
        // PDF.js worker 설정 (5.x 버전 호환)
        pdf.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdf.version}/pdf.worker.min.js`;
        
        const loadingTask = pdf.getDocument({ data: arrayBuffer });
        const pdfDocument = await loadingTask.promise;
        
        let fullText = '';
        for (let i = 1; i <= pdfDocument.numPages; i++) {
          const page = await pdfDocument.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        
        resolve(fullText);
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsArrayBuffer(file);
  });
};

// 7C PDF 텍스트를 14개 컬럼 테이블로 변환
export const convert7CPDFTextToTable = (text: string): any[][] => {
  const tableData: any[][] = [];
  
  // 실제 PDF의 14개 컬럼 헤더
  const header = [
    'Date', 'Pairing', 'DC', 'C/I (L)', 'C/O (L)', 'Activity', 
    'From', 'STD (L)', 'STD (B)', 'To', 'STA (L)', 'STA (B)', 
    'AC/Hotel', 'Blk Hrs'
  ];
  tableData.push(header);
  
  // 텍스트를 줄 단위로 분리 (실제 PDF는 공백으로 구분된 연속 텍스트)
  // 먼저 \n으로 분리 시도
  let lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // 만약 1줄만 있다면 공백으로 분리하여 날짜 패턴을 기준으로 줄 나누기
  if (lines.length === 1) {
    const words = text.split(/\s+/).filter(word => word.trim().length > 0);
    
    // 날짜 패턴을 찾아서 줄 나누기
    const datePattern = /(\d{2}[A-Za-z]{3}\d{2})/;
    const newLines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      if (word.match(datePattern)) {
        // 새로운 날짜 발견 - 이전 줄 저장하고 새 줄 시작
        if (currentLine.trim()) {
          newLines.push(currentLine.trim());
        }
        currentLine = word;
      } else {
        currentLine += ' ' + word;
      }
    }
    
    // 마지막 줄 추가
    if (currentLine.trim()) {
      newLines.push(currentLine.trim());
    }
    
    lines = newLines;
  }
  
  // 헤더 줄 찾기
  let dataStartIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('Date') && line.includes('Pairing') && line.includes('Activity')) {
      dataStartIndex = i + 1;
      break;
    }
  }
  
  if (dataStartIndex === -1) {
    console.error('7C PDF에서 헤더를 찾을 수 없습니다.');
    return tableData;
  }
  
  // 실제 데이터 줄들 처리
  let lastDate = '';
  let foundDates: string[] = [];
  
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;
    
    // 줄을 공백으로 분리 (PDF의 컬럼 구분자)
    const columns = line.split(/\s+/).filter(col => col.trim().length > 0);
    if (columns.length === 0) continue;
    
    // 실제 컬럼 수에 맞게 정규화 (먼저 정의)
    const normalizedRow = [...columns];
    
    // 첫 번째 컬럼이 날짜인지 확인
    const datePattern = /(\d{2}[A-Za-z]{3}\d{2})/;
    let currentDate = '';
    
    if (columns[0].match(datePattern)) {
      // 새로운 날짜가 있는 행
      currentDate = columns[0];
      lastDate = currentDate;
      foundDates.push(currentDate);
    } else {
      // 날짜가 없는 행 (연속 행) - 이전 날짜 사용
      currentDate = lastDate;
    }
    
    // 첫 번째 컬럼에 날짜 설정
    normalizedRow[0] = currentDate;
    
    // 비행 스케줄인 경우에만 처리 (Activity가 3-4자리 숫자인 경우)
    // 컬럼 수에 따라 다른 인덱스에서 Activity를 확인
    let activityIndex = -1;
    if (normalizedRow.length === 8) {
      activityIndex = 1; // 13Sep25 VAC_R GMP 0000 0000 GMP 2359 2359
    } else if (normalizedRow.length === 12) {
      activityIndex = 3; // 08Sep25 MXF1305 1450 1305 ICN...
    } else if (normalizedRow.length === 10) {
      activityIndex = 1; // 2234 1306 KIX...
    } else if (normalizedRow.length === 9) {
      activityIndex = 2; // 22Sep25 F1615 1615 BKI...
    } else if (normalizedRow.length === 13) {
      activityIndex = 4; // 09Sep25 MXF2603 1700 2350 2603 ICN...
    } else if (normalizedRow.length === 14) {
      activityIndex = 4; // 01Oct25 MXF2503A 0000 0940 2504 BKK...
    } else if (normalizedRow.length === 22) {
      // 22개 컬럼: 27Sep25 F1171 0605 1171 ICN 0815 0815 NRT 1040 1040 738 2:25 1535 1172 NRT 1130 1130 ICN 1435 1435 738 3:05
      // 첫 번째 비행: 1171, 두 번째 비행: 1172
      activityIndex = 3; // 1171
    } else if (normalizedRow.length === 23) {
      // 23개 컬럼: 22Sep25 F2121 0700 1320 2121 ICN 0910 0910 TAG 1300 1400 738 4:50 LAYOV TAG 1335 1435 TAG 1245+1 1345+1 BE Grand Resort
      activityIndex = 4; // 2121
    }
    
    // 전체 행에서 VAC 스케줄 먼저 확인
    const rowText = normalizedRow.join(' ');
    if (rowText.includes('VAC_R') || rowText.includes('VAC')) {
      // VAC 스케줄은 바로 처리
      processRow(normalizedRow, i, tableData);
    } else if (activityIndex >= 0 && normalizedRow[activityIndex]) {
      const activity = normalizedRow[activityIndex];
      const isFlightActivity = activity.match(/^\d{3,4}$/);
      const isSpecialActivity = activity === 'BKK' || activity === 'LAYOV' || 
                                activity === 'RT_G1' || activity === 'RT_G2' || activity === 'R_SIM1' || activity === 'R_SIM2';
      
      // 비행 스케줄(3-4자리 숫자) 또는 특별 스케줄인 경우 처리
      if (isFlightActivity || isSpecialActivity) {
        // 호텔 정보 필터링 (HYATT, REGENCY 등이 포함된 경우 제외)
        // 단, 23개 컬럼 구조는 LAYOV가 포함되어도 비행 스케줄이므로 처리
        if (normalizedRow.length === 23) {
          // 23개 컬럼 구조는 LAYOV가 포함되어도 비행 스케줄 처리
          processRow(normalizedRow, i, tableData);
        } else if (rowText.includes('RT_G1') || rowText.includes('RT_G2') || rowText.includes('R_SIM1') || rowText.includes('R_SIM2')) {
          // RT_G1/RT_G2/R_SIM1/R_SIM2는 특별 스케줄로 처리 (BKK 제외)
          processRow(normalizedRow, i, tableData);
        } else if (!rowText.includes('HYATT') && !rowText.includes('REGENCY') && 
            !rowText.includes('OFF') && !rowText.includes('LAYOV')) {
          // LAYOV 필터링 추가 - LAYOV는 파싱하지 않음
          processRow(normalizedRow, i, tableData);
        }
      }
    } else {
      // Activity 인덱스가 -1이거나 Activity가 없는 경우에도 VAC 스케줄 확인
      if (rowText.includes('VAC_R') || rowText.includes('VAC')) {
        processRow(normalizedRow, i, tableData);
      }
    }
  }
  
  
  return tableData;
};

// 실제 컬럼 구조의 행 처리 함수
const processRow = (row: string[], rowIndex: number, tableData: any[][]): void => {
  
  if (row.length < 8) {
    return;
  }
  
  // 전체 행에서 VAC 스케줄 감지 (Activity 컬럼뿐만 아니라 어디든)
  const rowText = row.join(' ');
  if (rowText.includes('VAC_R') || rowText.includes('VAC')) {
    // VAC 스케줄을 휴가 스케줄로 구분하여 처리
    const date = row[0];
    const datePattern = /(\d{2}[A-Za-z]{3}\d{2})/;
    if (!date.match(datePattern)) {
      return;
    }
    
    const day = date.substring(0, 2);
    const month = date.substring(2, 5);
    const year = '20' + date.substring(5, 7);
    
    const monthMap: { [key: string]: string } = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    
    const monthNum = monthMap[month];
    if (!monthNum) return;
    
    const lastDate = `${year}-${monthNum}-${day}`;
    
    // VAC 스케줄 정보 생성 (OZ 파서와 동일한 방식으로 휴가 스케줄 구분)
    const vacInfo = [
      row[0],           // 날짜
      '',               // pairing
      rowText.includes('VAC_R') ? 'VAC_R' : 'VAC',  // flightNumber (원본 그대로)
      '',               // from
      '',               // std
      '',               // to
      '',               // sta
      ''                // acType
    ];
    
    tableData.push(vacInfo);
    return;
  }
  
  let actualActivity, actualFrom, actualStd, actualTo, actualSta, actualAc;
  
  // 컬럼 수에 따른 다른 매핑 로직
  if (row.length === 8) {
    // 8개 컬럼: 13Sep25 VAC_R GMP 0000 0000 GMP 2359 2359 또는 RT_G2/R_SIM2
    // 0       1     2   3    4    5    6    7
    actualActivity = row[1];  // VAC_R, VAC, RT_G2, R_SIM2 등
    
    // RT_G2/R_SIM1/R_SIM2는 특별 스케줄이므로 from/to를 빈칸으로 설정
    if (actualActivity === 'RT_G2' || actualActivity === 'R_SIM1' || actualActivity === 'R_SIM2') {
      actualFrom = '';        // 빈칸
      actualStd = '';         // 빈칸
      actualTo = '';          // 빈칸
      actualSta = '';         // 빈칸
      actualAc = '';          // 빈칸
    } else {
      // VAC 스케줄의 경우
      actualFrom = row[2];      // GMP
      actualStd = row[3];       // 0000
      actualTo = row[5];        // GMP
      actualSta = row[6];       // 2359
      actualAc = '';            // VAC 스케줄은 기종 없음
    }
  } else if (row.length === 12) {
    // 12개 컬럼: 08Sep25 MXF1305 1450 1305 ICN 1657 1657 KIX 1854 1854 7M8 1:57
    // 0       1        2    3    4    5    6    7    8    9    10   11
    actualActivity = row[3];  // 1305
    actualFrom = row[4];      // ICN
    actualStd = row[5];       // 1657
    actualTo = row[7];        // KIX
    actualSta = row[8];       // 1854
    actualAc = row[10];       // 7M8
  } else if (row.length === 10) {
    // 10개 컬럼: 2234 1306 KIX 1943 1943 ICN 2134 2134 7M8 1:51
    // 0    1    2   3    4    5    6    7    8   9
    actualActivity = row[1];  // 1306
    actualFrom = row[2];      // KIX
    actualStd = row[3];       // 1943
    actualTo = row[5];        // ICN
    actualSta = row[6];       // 2134
    actualAc = row[8];        // 7M8
  } else if (row.length === 9) {
    // 9개 컬럼: 22Sep25 F1615 1615 BKI 0900 ICN 1400 738 3:00
    // 0       1     2    3    4    5    6    7   8
    actualActivity = row[2];  // 1615
    actualFrom = row[3];      // BKI
    actualStd = row[4];       // 0900
    actualTo = row[5];        // ICN
    actualSta = row[6];       // 1400
    actualAc = row[7];        // 738
  } else if (row.length === 13) {
    // 13개 컬럼: 09Sep25 MXF2603 1700 2350 2603 ICN 1910 1910 BKI 2330 0030+1 7M8 5:20
    // 0       1        2    3    4    5    6    7    8    9    10    11    12
    actualActivity = row[4];  // 2603
    actualFrom = row[5];      // ICN
    actualStd = row[6];       // 1910
    actualTo = row[8];        // BKI
    actualSta = row[9];       // 2330
    actualAc = row[11];       // 7M8 (인덱스 11이 AC, 인덱스 12는 블록 타임)
  } else if (row.length === 14) {
    // 14개 컬럼: 01Oct25 MXF2503A 0000 0940 2504 BKK 0100 0300 ICN 0840 0840 7M8 5:40 1
    // 0       1        2     3    4    5    6    7    8    9    10   11   12   13
    actualActivity = row[4];  // 2504
    actualFrom = row[5];      // BKK
    actualStd = row[6];       // 0100
    actualTo = row[8];        // ICN
    actualSta = row[9];       // 0840
    actualAc = row[11];       // 7M8
  } else if (row.length === 22) {
    // 22개 컬럼: 27Sep25 F1171 0605 1171 ICN 0815 0815 NRT 1040 1040 738 2:25 1535 1172 NRT 1130 1130 ICN 1435 1435 738 3:05
    // 0       1     2    3    4    5    6    7    8    9    10   11   12   13   14   15   16   17   18   19   20   21
    actualActivity = row[3];  // 1171 (첫 번째 비행)
    actualFrom = row[4];      // ICN
    actualStd = row[5];       // 0815
    actualTo = row[7];        // NRT
    actualSta = row[8];       // 1040
    actualAc = row[10];       // 738
  } else if (row.length === 23) {
    // 23개 컬럼: 22Sep25 F2121 0700 1320 2121 ICN 0910 0910 TAG 1300 1400 738 4:50 LAYOV TAG 1335 1435 TAG 1245+1 1345+1 BE Grand Resort
    // 0       1     2    3    4    5    6    7    8    9    10   11   12   13   14   15   16   17   18   19   20   21   22
    actualActivity = row[4];  // 2121
    actualFrom = row[5];      // ICN
    actualStd = row[6];       // 0910
    actualTo = row[8];        // TAG
    actualSta = row[9];       // 1300
    actualAc = row[11];       // 738 (기종 정보는 row[11]에 있음)
    
  } else {
    return;
  }
  
  // 22개 컬럼 구조에서 두 번째 비행도 추출
  if (row.length === 22) {
    // 두 번째 비행: 1535 1172 NRT 1130 1130 ICN 1435 1435 738 3:05
    // 인덱스: 13   14   15   16   17   18   19   20   21
    const secondActivity = row[13];  // 1172
    const secondFrom = row[14];      // NRT
    const secondStd = row[15];       // 1130
    const secondTo = row[17];        // ICN
    const secondSta = row[18];       // 1435
    const secondAc = row[20];        // 738
    
    
    if (secondActivity && secondActivity.match(/^\d{3,4}$/)) {
      // 두 번째 비행 정보 생성
      const secondFlightInfo = [
        row[0],           // 날짜
        '',               // pairing
        secondActivity,   // flightNumber
        secondFrom,       // from
        secondStd,        // std
        secondTo,         // to
        secondSta,        // sta
        secondAc          // acType
      ];
      
      tableData.push(secondFlightInfo);
    }
  }
  
  // 23개 컬럼 구조에서 두 번째 비행도 추출 (LAYOV 포함)
  if (row.length === 23) {
    // 두 번째 비행: LAYOV TAG 1335 1435 TAG 1245+1 1345+1 BE Grand Resort
    // 인덱스: 13   14   15   16   17   18   19   20   21   22
    const secondActivity = row[15];  // 1435 (두 번째 비행 번호)
    const secondFrom = row[14];      // TAG
    const secondStd = row[15];       // 1335
    const secondTo = row[17];        // TAG
    const secondSta = row[18];       // 1245+1
    const secondAc = row[20];        // BE Grand Resort (호텔 정보)
    
    // 23개 컬럼 구조에서는 LAYOV가 포함되어 있으므로 두 번째 비행은 실제로는 LAYOV 정보
    // 따라서 두 번째 비행을 별도로 추출하지 않음
  }
  
  

  // 날짜 변환 (01Sep25 -> 2025-09-01)
  const date = row[0]; // 첫 번째 컬럼이 날짜
  const datePattern = /(\d{2}[A-Za-z]{3}\d{2})/;
  if (!date.match(datePattern)) {
    return;
  }
  
  const day = date.substring(0, 2);
  const month = date.substring(2, 5);
  const year = '20' + date.substring(5, 7);
  
      const monthMap: { [key: string]: string } = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      
      const monthNum = monthMap[month] || '01';
  const convertedDate = `${year}-${monthNum}-${day}`;
  
  // STD/STA 시간 처리 (+1, +2 등 날짜 표시 처리)
  let stdTime = actualStd || '';
  let staTime = actualSta || '';
  
  // +1, +2 등이 포함된 경우 처리
  if (stdTime.includes('+')) {
    stdTime = stdTime.replace(/\+.*$/, '');
  }
  if (staTime.includes('+')) {
    staTime = staTime.replace(/\+.*$/, '');
  }
  
  // Block time 추출 (마지막 컬럼에서)
  let blockTime = '';
  if (row.length >= 12) {
    // 12개 이상 컬럼인 경우 마지막 컬럼이 block time
    blockTime = row[row.length - 1] || '';
  } else if (row.length === 10) {
    // 10개 컬럼인 경우 마지막 컬럼이 block time
    blockTime = row[9] || '';
  } else if (row.length === 9) {
    // 9개 컬럼인 경우 마지막 컬럼이 block time
    blockTime = row[8] || '';
  }

  // RT_G1/RT_G2를 GROUND SCHOOL로 변환
  if (actualActivity === 'RT_G1' || actualActivity === 'RT_G2') {
    actualActivity = 'GROUND SCHOOL';
  }
  
  // R_SIM1/R_SIM2는 원본 그대로 유지
  // if (actualActivity === 'R_SIM1' || actualActivity === 'R_SIM2') {
  //   actualActivity = 'SIM';
  // }
  
  // C/I(L) 컬럼에서 SHOW UP 시간 추출 (컬럼 구조에 따라 다름)
  let showUpTime = '';
  
  // 디버깅을 위한 로그 (항상 표시)
  console.log('🔍 C/I(L) 추출 디버깅:', {
    rowLength: row.length,
    row: row,
    actualActivity: actualActivity,
    date: convertedDate,
    isSpecialDate: convertedDate.includes('-02-') || convertedDate.includes('-28-') || convertedDate.includes('-08-') || convertedDate.includes('-27-')
  });
  
  // 컬럼 수에 따른 C/I(L) 컬럼 위치 매핑
  // 실제 7C PDF 헤더: Date, Pairing, DC, C/I(L), C/O(L), Activity, From, STD(L), STD(B), To, STA(L), STA(B), AC/Hotel, Blk Hrs
  if (row.length === 8) {
    // 8개 컬럼: 13Sep25 VAC_R GMP 0000 0000 GMP 2359 2359
    // 0       1     2   3    4    5    6    7
    // C/I(L)은 3번째 컬럼 (인덱스 3)
    const ciTime = row[3];
    if (ciTime && ciTime.match(/^\d{4}$/)) {
      showUpTime = ciTime;
    }
  } else if (row.length === 12) {
    // 12개 컬럼: 08Sep25 MXF1305 1450 1305 ICN 1657 1657 KIX 1854 1854 7M8 1:57
    // 0       1        2    3    4    5    6    7    8    9    10   11
    // Date, Pairing, DC, C/I(L), C/O(L), Activity, From, STD(L), STD(B), To, STA(L), STA(B)
    // C/I(L)은 3번째 컬럼 (인덱스 3) = 1450
    const ciTime = row[3];
    if (ciTime && ciTime.match(/^\d{4}$/)) {
      showUpTime = ciTime;
    }
  } else if (row.length === 10) {
    // 10개 컬럼: 2234 1306 KIX 1943 1943 ICN 2134 2134 7M8 1:51
    // 0    1    2   3    4    5    6    7    8   9
    // C/I(L), C/O(L), Activity, From, STD(L), STD(B), To, STA(L), STA(B), AC/Hotel
    // C/I(L)은 1번째 컬럼 (인덱스 0) = 2234
    const ciTime = row[0];
    if (ciTime && ciTime.match(/^\d{4}$/)) {
      showUpTime = ciTime;
    }
  } else if (row.length === 9) {
    // 9개 컬럼: 22Sep25 F1615 1615 BKI 0900 ICN 1400 738 3:00
    // 0       1     2    3    4    5    6    7   8
    // Date, Pairing, C/I(L), C/O(L), Activity, From, STD(L), STD(B), To
    // C/I(L)은 2번째 컬럼 (인덱스 2) = 1615
    const ciTime = row[2];
    if (ciTime && ciTime.match(/^\d{4}$/)) {
      showUpTime = ciTime;
    }
  } else if (row.length === 13) {
    // 13개 컬럼: 09Sep25 MXF2603 1700 2350 2603 ICN 1910 1910 BKI 2330 0030+1 7M8 5:20
    // 0       1        2    3    4    5    6    7    8    9    10    11    12
    // Date, Pairing, DC, C/I(L), C/O(L), Activity, From, STD(L), STD(B), To, STA(L), STA(B), AC/Hotel
    // C/I(L)은 3번째 컬럼 (인덱스 3) = 1700
    const ciTime = row[3];
    if (ciTime && ciTime.match(/^\d{4}$/)) {
      showUpTime = ciTime;
    }
  } else if (row.length === 14) {
    // 14개 컬럼: 01Oct25 MXF2503A 0000 0940 2504 BKK 0100 0300 ICN 0840 0840 7M8 5:40 1
    // 0       1        2     3    4    5    6    7    8    9    10   11   12   13
    // Date, Pairing, DC, C/I(L), C/O(L), Activity, From, STD(L), STD(B), To, STA(L), STA(B), AC/Hotel, Blk Hrs
    // C/I(L)은 3번째 컬럼 (인덱스 3) = 0000
    const ciTime = row[3];
    if (ciTime && ciTime.match(/^\d{4}$/)) {
      showUpTime = ciTime;
    }
  } else if (row.length === 22) {
    // 22개 컬럼: 27Sep25 F1171 0605 1171 ICN 0815 0815 NRT 1040 1040 738 2:25 1535 1172 NRT 1130 1130 ICN 1435 1435 738 3:05
    // 0       1     2    3    4    5    6    7    8    9    10   11   12   13   14   15   16   17   18   19   20   21
    // Date, Pairing, C/I(L), C/O(L), Activity, From, STD(L), STD(B), To, STA(L), STA(B), AC/Hotel, Blk Hrs, C/I(L), C/O(L), Activity, From, STD(L), STD(B), To, STA(L), STA(B)
    // 첫 번째 C/I(L)은 2번째 컬럼 (인덱스 2) = 0605
    const ciTime = row[2];
    if (ciTime && ciTime.match(/^\d{4}$/)) {
      showUpTime = ciTime;
    }
  } else if (row.length === 23) {
    // 23개 컬럼: 22Sep25 F2121 0700 1320 2121 ICN 0910 0910 TAG 1300 1400 738 4:50 LAYOV TAG 1335 1435 TAG 1245+1 1345+1 BE Grand Resort
    // 0       1     2    3    4    5    6    7    8    9    10   11   12   13   14   15   16   17   18   19   20   21   22
    // Date, Pairing, C/I(L), C/O(L), Activity, From, STD(L), STD(B), To, STA(L), STA(B), AC/Hotel, Blk Hrs, LAYOV, From, C/I(L), C/O(L), Activity, From, STD(L), STD(B), Hotel
    // 첫 번째 C/I(L)은 2번째 컬럼 (인덱스 2) = 0700
    const ciTime = row[2];
    if (ciTime && ciTime.match(/^\d{4}$/)) {
      showUpTime = ciTime;
    }
  }

  // 비행 정보 생성 (Activity에서만 항공편 정보 추출, AC에서 항공기종 추출)
  const flightInfo = [
    convertedDate,    // Date
    '',               // Pairing (사용하지 않음)
    actualActivity,   // Activity (Flight Number)
    actualFrom || '', // From
    stdTime,          // STD
    actualTo || '',   // To
    staTime,          // STA
    actualAc || '',   // AC (항공기종)
    blockTime,        // Block Time
    showUpTime        // Show Up Time
  ];
  
  tableData.push(flightInfo);
};

// 7C 데이터 파싱 로직 (8개 컬럼 구조로 변경)
export const parse7CData = (data: any[][]): Flight[] => {
  const flights: Flight[] = [];
  let lastDate = '';

  // 공항별 시간대 매핑
  const airportTimezones: { [key: string]: string } = {
    'ICN': 'Asia/Seoul',
    'GMP': 'Asia/Seoul',
    'KIX': 'Asia/Tokyo',
    'BKI': 'Asia/Kuching',
    'HIJ': 'Asia/Tokyo',
    'TAG': 'Asia/Manila',
    'NRT': 'Asia/Tokyo',
    'BKK': 'Asia/Bangkok'
  };

  // UTC 시간 변환 함수
  const convertToUTC = (date: string, time: string, airport: string): string | undefined => {
    if (!time || time === '') return undefined;
    
    const timezone = airportTimezones[airport];
    if (!timezone) {
      console.warn(`알 수 없는 공항 시간대: ${airport}`);
      return undefined;
    }

    try {
      let hours, minutes;
      
      // 시간 형식 처리 (1657 -> 16:57 또는 16:57 -> 16:57)
      if (time.includes(':')) {
        [hours, minutes] = time.split(':').map(Number);
      } else if (time.length === 4) {
        // 4자리 시간 형식 (1657)
        hours = parseInt(time.substring(0, 2));
        minutes = parseInt(time.substring(2, 4));
      } else {
        console.warn(`알 수 없는 시간 형식: ${time}`);
        return undefined;
      }
      
      const localDateTime = new Date(date);
      localDateTime.setHours(hours, minutes, 0, 0);
      
      const utcDateTime = fromZonedTime(localDateTime, timezone);
      return utcDateTime.toISOString();
    } catch (error) {
      console.error(`UTC 변환 오류 (${airport} ${time}):`, error);
      return undefined;
    }
  };

  // 항공기 타입 변환 함수
  const convertAircraftType = (acType: string): string => {
    if (!acType) return '';
    
    // 7M8 -> MAX8, 738 -> 738
    if (acType === '7M8') return 'MAX8';
    if (acType === '738') return '738';
    
    return acType;
  };

  // 헤더를 제외한 데이터 행들 처리
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.length < 8) continue;

    // 컬럼 수에 따라 다른 구조분해할당
    let date, pairing, flightNumber, from, std, to, sta, acType, blockTimeStr, showUpTime;
    
    if (row.length === 8) {
      // 8개 컬럼: 13Sep25 VAC_R GMP 0000 0000 GMP 2359 2359 또는 processRow에서 생성된 데이터
      [date, pairing, flightNumber, from, std, to, sta, acType] = row;
      blockTimeStr = '';
      showUpTime = '';
    } else if (row.length === 10) {
      // 10개 컬럼: processRow에서 생성된 데이터 (showUpTime 포함)
      [date, pairing, flightNumber, from, std, to, sta, acType, blockTimeStr, showUpTime] = row;
    } else {
      // 9개 이상 컬럼: 일반 비행 스케줄
      [date, pairing, flightNumber, from, std, to, sta, acType, blockTimeStr] = row;
      showUpTime = '';
    }
    
    // 날짜가 있으면 업데이트
    if (date && date !== '') {
      lastDate = date;
    }

    // 필수 정보 확인 (VAC 스케줄은 예외)
    if (!flightNumber) {
      continue;
    }

    // RT_G1/RT_G2를 GROUND SCHOOL로 변환
    if (flightNumber === 'RT_G1' || flightNumber === 'RT_G2') {
      flightNumber = 'GROUND SCHOOL';
    }
    
    // R_SIM1/R_SIM2는 원본 그대로 유지
    // if (flightNumber === 'R_SIM1' || flightNumber === 'R_SIM2') {
    //   flightNumber = 'SIM';
    // }
    
    // 숫자로만 이루어진 flightNumber가 있는 경우 (0900, 1630 등) 특별 스케줄로 처리
    if (flightNumber && flightNumber.match(/^\d{3,4}$/)) {
      // 이는 RT_G2나 R_SIM2에서 변환되지 않은 경우일 수 있음
      // 원본 row에서 RT_G2나 R_SIM2가 있는지 확인
      const originalRowText = row.join(' ');
      if (originalRowText.includes('RT_G2')) {
        flightNumber = 'GROUND SCHOOL';
      } else if (originalRowText.includes('R_SIM1')) {
        flightNumber = 'R_SIM1';
      } else if (originalRowText.includes('R_SIM2')) {
        flightNumber = 'R_SIM2';
      }
    }
    
    // VAC 스케줄인 경우 특별 처리 (OZ 파서와 동일한 방식)
    if (flightNumber === 'VAC_R' || flightNumber === 'VAC') {
      // VAC 스케줄 정보 생성 (OZ 파서의 휴가 스케줄과 동일한 구조)
      const newFlight: Flight = {
        id: Math.floor(Date.now() + Math.random() * 1000),
        date: lastDate,
        flightNumber: flightNumber,
        route: '', // VAC 스케줄은 route가 비어있음 (OZ 파서와 동일)
        std: '',
        sta: '',
        block: 0,
        crew: [],
        status: { departed: false, landed: false },
        acType: '',
        scheduleType: '7C',
        lastUpdated: new Date().toISOString()
      };
      
      flights.push(newFlight);
      continue;
    }
    
    // 특별 스케줄인 경우 처리 (OZ 파서와 동일한 방식)
    const isSpecialSchedule = flightNumber && (
      flightNumber.toUpperCase().includes('GROUND SCHOOL') ||
      flightNumber.toUpperCase().includes('R_SIM1') ||
      flightNumber.toUpperCase().includes('R_SIM2') ||
      flightNumber.toUpperCase().includes('OFF') ||
      flightNumber.toUpperCase().includes('LAYOV') ||
      flightNumber.toUpperCase().includes('MEDICAL') ||
      flightNumber.toUpperCase().includes('TRAINING') ||
      flightNumber.toUpperCase().includes('BRIEFING') ||
      flightNumber.toUpperCase().includes('MEETING') ||
      flightNumber.toUpperCase().includes('CHECK') ||
      flightNumber.toUpperCase().includes('INSPECTION') ||
      flightNumber.toUpperCase().includes('VAC_R') ||
      flightNumber.toUpperCase().includes('VAC')
    );
    
    if (isSpecialSchedule) {
      // 특별 스케줄 정보 생성 (OZ 파서와 동일한 구조)
      const newFlight: Flight = {
        id: Math.floor(Date.now() + Math.random() * 1000),
        date: lastDate,
        flightNumber: flightNumber,
        route: '', // 특별 스케줄은 route가 비어있음 (OZ 파서와 동일)
        std: '',
        sta: '',
        block: 0,
        crew: [],
        status: { departed: false, landed: false },
        acType: '',
        scheduleType: '7C',
        lastUpdated: new Date().toISOString()
      };
      
      flights.push(newFlight);
      continue;
    }
    
    // 일반 비행 스케줄의 경우 from, to 필수
    if (!from || !to) {
      continue;
    }

    // 항공기 타입 변환 (AC 컬럼에서 추출)
    const aircraftType = convertAircraftType(acType);

    // Block time 파싱 (HH:MM 형식을 분으로 변환)
    const parseBlockTime = (blockTimeStr: string): number => {
      if (!blockTimeStr || blockTimeStr === '') return 0;
      
      // "1:57", "3:05" 등의 형식을 분으로 변환
      const match = blockTimeStr.match(/(\d+):(\d+)/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        return hours * 60 + minutes;
      }
      
      return 0;
    };

    const blockTime = parseBlockTime(blockTimeStr);
    
    // UTC 시간 변환
    const departureDateTimeUtc = std ? convertToUTC(lastDate, std, from) : undefined;
    const arrivalDateTimeUtc = sta ? convertToUTC(lastDate, sta, to) : undefined;
    
    // Show Up 시간 UTC 변환 (한국에서 출발하는 경우에만)
    const koreanAirports = getAirportsByCountry('South Korea');
    const showUpDateTimeUtc = (showUpTime && from && koreanAirports.includes(from)) 
      ? convertToUTC(lastDate, showUpTime, from) 
      : undefined;

    // Flight 객체 생성
    const newFlight: Flight = {
      id: Math.floor(Date.now() + Math.random() * 1000),
      date: lastDate,
      flightNumber: flightNumber,
      route: `${from}/${to}`,
      std: std || '',
      sta: sta || '',
      block: blockTime, // 파싱된 블록 타임 사용
      crew: [],
      status: { departed: false, landed: false },
      acType: aircraftType,
      scheduleType: '7C', // 7C 스케줄 타입 설정
      lastUpdated: new Date().toISOString()
    };

    // UTC 시간이 유효한 경우에만 추가
    if (departureDateTimeUtc) {
      newFlight.departureDateTimeUtc = departureDateTimeUtc;
    }
    if (arrivalDateTimeUtc) {
      newFlight.arrivalDateTimeUtc = arrivalDateTimeUtc;
    }
    if (showUpDateTimeUtc) {
      newFlight.showUpDateTimeUtc = showUpDateTimeUtc;
    }

    flights.push(newFlight);
  }

  return flights;
};
