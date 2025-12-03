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

      // 날짜 유효성 검사
      if (day < 1 || day > 31 || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        console.warn(`⚠️ 유효하지 않은 날짜/시간 값: ${value}`);
        return { date: baseDate, time: '00:00' };
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

      // 시간 유효성 검사
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        console.warn(`⚠️ 유효하지 않은 시간 값: ${value}`);
        return { date: baseDate, time: '00:00' };
      }

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

    // ✨ 수정된 부분: 한국 공항 목록을 만들어 출발 공항이 포함되는지 확인
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

    // 유효한 Date 객체인지 확인
    if (isNaN(showUpUtc.getTime())) {
      console.error('❌ 유효하지 않은 Show Up 날짜 객체:', {
        departureDateTimeString,
        showUpUtc
      });
      return undefined;
    }

    return showUpUtc.toISOString();
  } catch (error) {
    console.error('Show Up 시간 계산 오류:', error);
    return undefined;
  }
};

// 현지시간을 UTC로 변환하는 함수 (수정된 버전)
const convertLocalTimeToUTC = (departureDate: string, departureTime: string, arrivalDate: string, arrivalTime: string, route: string): {
  departureDateTimeUtc?: string,
  arrivalDateTimeUtc?: string
} => {
  try {
    if (!departureTime || !arrivalTime || !route) {
      // 정보가 불충분할 경우 undefined 반환
      return { departureDateTimeUtc: undefined, arrivalDateTimeUtc: undefined };
    }

    const [depAirport, arrAirport] = route.split('/');
    const depTz = getTimezone(depAirport);
    const arrTz = getTimezone(arrAirport);

    // 타임존 정보가 없으면 변환 불가
    if (!depTz || !arrTz) {
      console.error(`⚠️ 시간대 정보를 찾을 수 없습니다: ${route}`);
      return { departureDateTimeUtc: undefined, arrivalDateTimeUtc: undefined };
    }

    // 출발 시간을 현지시간으로 생성하고 UTC로 변환
    const departureDateTimeString = `${departureDate}T${departureTime}`;
    // 'Asia/Seoul' 시간대의 '2023-10-27T09:00'을 UTC로 변환
    const departureUtc = fromZonedTime(departureDateTimeString, depTz);

    // 도착 시간을 현지시간으로 생성하고 UTC로 변환
    const arrivalDateTimeString = `${arrivalDate}T${arrivalTime}`;
    const arrivalUtc = fromZonedTime(arrivalDateTimeString, arrTz);


    // 유효한 Date 객체인지 확인 후 ISO 8601 형식의 UTC 문자열로 반환
    if (isNaN(departureUtc.getTime()) || isNaN(arrivalUtc.getTime())) {
      console.error('❌ 유효하지 않은 날짜 객체:', {
        departureDateTimeString: `${departureDate}T${departureTime}`,
        arrivalDateTimeString: `${arrivalDate}T${arrivalTime}`,
        route
      });
      return { departureDateTimeUtc: undefined, arrivalDateTimeUtc: undefined };
    }

    return {
      departureDateTimeUtc: departureUtc.toISOString(),
      arrivalDateTimeUtc: arrivalUtc.toISOString()
    };
  } catch (error) {
    console.error('시간 변환 오류:', error);
    return { departureDateTimeUtc: undefined, arrivalDateTimeUtc: undefined };
  }
};

// 아시아나항공(OZ) 전용 엑셀 파싱 함수
export const parseOZExcel = (jsonData: any[][], userId?: string): Flight[] => {
  console.log('🚀 OZ 파서 시작:', {
    jsonDataLength: jsonData.length,
    userId,
    firstRow: jsonData[0],
    secondRow: jsonData[1],
    thirdRow: jsonData[2],
    fourthRow: jsonData[3]
  });

  // BRIEFING INFO 형식인지 확인 (기존 스케줄과 병합용)
  let isBriefingFormat = false;
  let briefingFlightDate = '';
  let briefingFlightNumber = '';
  let briefingRegNo = '';
  let briefingCabinCrew: CrewMember[] = [];
  let briefingCockpitCrew: CrewMember[] = [];

  // BRIEFING INFO 감지 로직 (더 정확한 조건)
  const firstRow = jsonData[0];
  if (firstRow && Array.isArray(firstRow)) {
    const firstRowText = firstRow.join(' ').toUpperCase().trim();
    // 첫 번째 행이 정확히 "BRIEFING INFO"를 포함하고 "MONTHLY"를 포함하지 않는 경우만
    if (firstRowText.includes('BRIEFING INFO') && !firstRowText.includes('MONTHLY')) {
      isBriefingFormat = true;
    }
  }

  // 월간 스케줄 형식 확인
  const isMonthlySchedule = firstRow && Array.isArray(firstRow) &&
    firstRow.join(' ').toUpperCase().includes('MONTHLY');

  if (isMonthlySchedule) {
    // Monthly schedule detected
  }

  if (!isBriefingFormat && !isMonthlySchedule) {

  }

  // 4번째 행에서 DUTY 정보 추출 (월별 총 BLOCK 시간) - A4:U4 범위
  let monthlyTotalBlock = '00:00';
  const dutyRow = jsonData[3] as any[];


  if (Array.isArray(dutyRow)) {
    dutyRow.forEach((cell, colIndex) => {
      if (cell && typeof cell === 'string') {
        const cellUpper = cell.toUpperCase();

        // 다양한 DUTY 패턴 매칭
        const patterns = [
          /DUTY\s*:\s*(\d{1,3}):(\d{2})/i,           // DUTY: 97:05
          /DUTY\s*(\d{1,3}):(\d{2})/i,               // DUTY 97:05
          /(\d{1,3}):(\d{2})\s*\(BLOCK\)/i,          // 97:05(BLOCK)
          /BLOCK\s*:\s*(\d{1,3}):(\d{2})/i,          // BLOCK: 97:05
          /(\d{1,3}):(\d{2})\s*BLOCK/i               // 97:05 BLOCK
        ];

        for (const pattern of patterns) {
          const match = cell.match(pattern);
          if (match) {
            const hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            monthlyTotalBlock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            return; // 첫 번째 매치에서 종료
          }
        }
      }
    });
  }


  // BRIEFING INFO 파싱용 변수 (스코프 문제 해결을 위해 밖에 선언)
  let foundRoute = '';
  let foundSTD = '';
  let foundSTA = '';

  // BRIEFING INFO 파싱 (기존 스케줄과 병합용)
  if (isBriefingFormat) {
    // 전체 데이터에서 기본 정보 추출
    let foundFlightDate = '';
    let foundFlightNumber = '';
    let foundRegNo = '';

    // FLIGHT SCHEDULE 테이블 파싱을 위한 변수
    let inFlightSchedule = false;
    let flightScheduleHeaderRow: any[] | null = null;

    // 모든 행을 순회하면서 기본 패턴 찾기
    jsonData.forEach((row, rowIndex) => {
      if (!Array.isArray(row)) return;

      const rowText = row.join(' ').toUpperCase();

      // FLIGHT SCHEDULE 섹션 감지
      if (rowText.includes('FLIGHT SCHEDULE')) {
        inFlightSchedule = true;
        // 다음 행이 헤더일 가능성이 높음
        if (rowIndex + 1 < jsonData.length) {
          flightScheduleHeaderRow = jsonData[rowIndex + 1];
        }
        return;
      }

      // COCKPIT SCHEDULE 또는 CABIN SCHEDULE 시작 시 FLIGHT SCHEDULE 종료
      if (rowText.includes('COCKPIT SCHEDULE') || rowText.includes('CABIN SCHEDULE')) {
        inFlightSchedule = false;
        flightScheduleHeaderRow = null;
      }

      // FLIGHT SCHEDULE 데이터 행 파싱
      if (inFlightSchedule && flightScheduleHeaderRow && rowIndex > 0) {
        // 헤더 행 자체는 건너뛰기
        if (row === flightScheduleHeaderRow) {
          return;
        }

        // 헤더에서 컬럼 인덱스 찾기
        const depIdx = flightScheduleHeaderRow.findIndex((cell: any) =>
          cell && String(cell).toUpperCase().trim() === 'DEP');
        const arrIdx = flightScheduleHeaderRow.findIndex((cell: any) =>
          cell && String(cell).toUpperCase().trim() === 'ARR');
        const stdIdx = flightScheduleHeaderRow.findIndex((cell: any) =>
          cell && String(cell).toUpperCase().trim() === 'STD');
        const staIdx = flightScheduleHeaderRow.findIndex((cell: any) =>
          cell && String(cell).toUpperCase().trim() === 'STA');

        // DEP/ARR에서 ROUTE 추출
        if (!foundRoute && depIdx >= 0 && arrIdx >= 0) {
          const dep = row[depIdx] ? String(row[depIdx]).trim() : '';
          const arr = row[arrIdx] ? String(row[arrIdx]).trim() : '';
          if (dep.match(/^[A-Z]{3}$/) && arr.match(/^[A-Z]{3}$/)) {
            foundRoute = `${dep}/${arr}`;
          }
        }

        // STD 추출
        if (!foundSTD && stdIdx >= 0 && row[stdIdx]) {
          const stdValue = String(row[stdIdx]).trim();
          // "01 12:25" 또는 "12:25" 형식
          if (stdValue.match(/\d{1,2}\s+\d{2}:\d{2}/) || stdValue.match(/^\d{2}:\d{2}$/)) {
            foundSTD = stdValue;
          }
        }

        // STA 추출
        if (!foundSTA && staIdx >= 0 && row[staIdx]) {
          const staValue = String(row[staIdx]).trim();
          // "01 18:05" 또는 "18:05" 형식
          if (staValue.match(/\d{1,2}\s+\d{2}:\d{2}/) || staValue.match(/^\d{2}:\d{2}$/)) {
            foundSTA = staValue;
          }
        }
      }

      // 기존 날짜/편명/등록번호 파싱 로직
      row.forEach((cell, colIndex) => {
        if (!cell) return;
        const cellValue = String(cell).trim();
        if (!cellValue) return;

        // 날짜 패턴 찾기 (2025-09-14, 9/14 등)
        if (!foundFlightDate) {
          const dateMatch1 = cellValue.match(/(\d{4}-\d{2}-\d{2})/);
          const dateMatch2 = cellValue.match(/(\d{1,2}\/\d{1,2})/);
          if (dateMatch1) {
            foundFlightDate = dateMatch1[1];
          } else if (dateMatch2) {
            const [month, day] = dateMatch2[1].split('/');
            const currentYear = new Date().getFullYear();
            foundFlightDate = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        }

        // 항공편번호 패턴 찾기 (OZ713, 713 등)
        if (!foundFlightNumber) {
          if (cellValue.match(/^(OZ|KE)?\d{3,4}$/)) {
            const flightNumberMatch = cellValue.match(/(\d{3,4})$/);
            if (flightNumberMatch) {
              foundFlightNumber = flightNumberMatch[1];
            }
          }
        }

        // 등록번호 패턴 찾기 (HL8521 등)
        if (!foundRegNo) {
          if (cellValue.match(/^[A-Z]{2}\d{4}$/)) {
            foundRegNo = cellValue;
          }
        }
      });
    });

    // 검색 결과를 사용
    if (foundFlightDate) briefingFlightDate = foundFlightDate;
    if (foundFlightNumber) briefingFlightNumber = foundFlightNumber;
    if (foundRegNo) briefingRegNo = foundRegNo;



    // 🔧 BRIEFING INFO에서만 CABIN SCHEDULE과 COCKPIT SCHEDULE 승무원 정보 파싱
    // 월 비행스케줄에서는 조종사 정보만 파싱됨
    let isInCabinSchedule = false;
    let isInCockpitSchedule = false;
    const defaultCabinColumnIndices = { empl: 6, name: 10, rank: 17, gisu: 18 };
    const cabinColumnIndices = { ...defaultCabinColumnIndices };
    let cabinHeaderProcessed = false;

    jsonData.forEach((row, rowIndex) => {
      if (!Array.isArray(row)) return;

      const normalizedRow = row.map((cell) => typeof cell === 'string'
        ? cell.toUpperCase().replace(/\s+/g, ' ').trim()
        : '');
      const normalizedRowNoSpace = row.map((cell) => typeof cell === 'string'
        ? cell.toUpperCase().replace(/\s+/g, '')
        : '');

      if (normalizedRow.some((value) => typeof value === 'string' && value.includes('CABIN SCHEDULE'))) {
        isInCabinSchedule = true;
        isInCockpitSchedule = false;
        cabinHeaderProcessed = false;
      }

      if (normalizedRow.some((value) => typeof value === 'string' && value.includes('COCKPIT SCHEDULE'))) {
        isInCockpitSchedule = true;
        isInCabinSchedule = false;
      }

      if (isInCabinSchedule && !cabinHeaderProcessed) {
        const headerEntries = normalizedRowNoSpace
          .map((value, index) => ({ value, index }))
          .filter(({ value }) => typeof value === 'string' && value.length > 0);

        const findIndex = (labels: string[]) => {
          const entry = headerEntries.find(({ value }) =>
            labels.some((label) => value === label || value.includes(label))
          );
          return entry ? entry.index : -1;
        };

        const headerLabels = ['EMPL', 'EMPNO', 'EMP#', 'EMP', 'NAME', 'RANK', 'GISU', 'GISUNO', 'GISU#', 'GISU.', 'GI-SU', 'GISUSN', 'GISUSTR', 'GI SU'];
        const hasHeader = headerEntries.some(({ value }) =>
          headerLabels.some((label) => value === label || value.includes(label))
        );

        if (hasHeader) {
          const emplIndex = findIndex(['EMPL', 'EMPNO', 'EMP#', 'EMP']);
          if (emplIndex !== -1) cabinColumnIndices.empl = emplIndex;

          const nameIndex = findIndex(['NAME']);
          if (nameIndex !== -1) cabinColumnIndices.name = nameIndex;

          const rankIndex = findIndex(['RANK']);
          if (rankIndex !== -1) cabinColumnIndices.rank = rankIndex;

          const gisuIndex = findIndex(['GISU', 'GISUNO', 'GISU#', 'GISU.', 'GI-SU', 'GISUSN', 'GISUSTR', 'GI SU']);
          if (gisuIndex !== -1) cabinColumnIndices.gisu = gisuIndex;

          cabinHeaderProcessed = true;
          return;
        }
      }

      if (isInCabinSchedule) {
        const empIndex = cabinColumnIndices.empl ?? defaultCabinColumnIndices.empl;
        const nameIndex = cabinColumnIndices.name ?? defaultCabinColumnIndices.name;
        const rankIndex = cabinColumnIndices.rank ?? defaultCabinColumnIndices.rank;
        const gisuIndex = cabinColumnIndices.gisu ?? -1;

        const empno = row[empIndex] ? String(row[empIndex]).trim() : '';
        const name = row[nameIndex] ? String(row[nameIndex]).trim() : '';
        const rank = row[rankIndex] ? String(row[rankIndex]).trim() : '';
        const gisu = gisuIndex >= 0 && row[gisuIndex] ? String(row[gisuIndex]).trim() : '';

        if (empno && name && rank && empno.match(/^\d+$/)) {
          const cabinCrewMember: CrewMember = {
            empl: empno,
            name,
            rank,
            posnType: '',
            posn: '',
            gisu
          };

          const isDuplicate = briefingCabinCrew.some((crew) =>
            crew.empl === empno || crew.name === name
          );

          if (!isDuplicate) {
            briefingCabinCrew.push(cabinCrewMember);
          }
        }
        return;
      }

      if (isInCockpitSchedule && row.length > 30) {
        const empno = row[4] ? String(row[4]).trim() : '';
        const name = row[9] ? String(row[9]).trim() : '';
        const rank = row[19] ? String(row[19]).trim() : '';
        const duty = row[29] ? String(row[29]).trim() : '';
        const position = row[33] ? String(row[33]).trim() : '';

        if (empno && name && rank && empno.match(/^\d+$/)) {
          const cockpitCrewMember: CrewMember = {
            empl: empno,
            name,
            rank,
            posnType: duty,
            posn: position,
            gisu: ''
          };

          const isDuplicate = briefingCockpitCrew.some(crew =>
            crew.empl === empno || crew.name === name
          );

          if (!isDuplicate) {
            briefingCockpitCrew.push(cockpitCrewMember);
          }
        }
      }
    });
  }

  // 브리핑 파일이라면, 기존 스케줄을 만들지 않고 업데이트용 항목만 반환
  if (isBriefingFormat && briefingFlightDate && briefingFlightNumber) {
    // STD/STA 파싱 - foundSTD, foundSTA 사용
    const stdParsed = parseDateTime(foundSTD, briefingFlightDate);
    const staParsed = parseDateTime(foundSTA, briefingFlightDate);

    // Route 추출
    const briefingRoute = foundRoute;  // FLIGHT SCHEDULE에서 파싱된 route

    // UTC 변환
    let departureDateTimeUtc: string | undefined;
    let arrivalDateTimeUtc: string | undefined;
    let showUpDateTimeUtc: string | undefined;

    if (briefingRoute && stdParsed.time && staParsed.time) {
      const utcTimes = convertLocalTimeToUTC(
        stdParsed.date, stdParsed.time,
        staParsed.date, staParsed.time,
        briefingRoute
      );
      departureDateTimeUtc = utcTimes.departureDateTimeUtc;
      arrivalDateTimeUtc = utcTimes.arrivalDateTimeUtc;

      // SHOW UP 시간 계산 (ICN 출발인 경우)
      if (departureDateTimeUtc) {
        showUpDateTimeUtc = calculateShowUpTime(
          stdParsed.date, stdParsed.time, briefingRoute
        );
      }
    }

    const flights: Flight[] = [];
    const briefingUpdate: Flight = {
      id: Math.floor(Math.random() * 1000000),
      date: briefingFlightDate,
      departureDateTimeUtc,
      arrivalDateTimeUtc,
      showUpDateTimeUtc,
      flightNumber: briefingFlightNumber,
      route: briefingRoute || '', // 파싱된 route 사용
      std: stdParsed.time,
      sta: staParsed.time,
      block: 0,
      status: { departed: false, landed: false },
      crew: briefingCockpitCrew,
      regNo: briefingRegNo || null,
      cabinCrew: briefingCabinCrew,
      isBriefingInfo: true // 브리핑 인포 플래그
    };

    flights.push(briefingUpdate);
    return flights;
  }

  // 5번째 행부터 데이터 추출 (기존 방식)
  const dataRows = jsonData.slice(4) as any[][];

  // 🔧 컬럼 인덱스 동적 감지 (파일마다 컬럼 위치가 달라질 수 있음)
  // 기본값 (현재 예상 위치)
  let idxDate = 0;
  let idxFlight = 1; // 일부 파일은 2일 수 있음
  let idxShowUp = 2;
  let idxSector = 3; // 일부 파일은 8일 수 있음
  let idxSTD = 4;    // 일부 파일은 10일 수 있음
  let idxSTA = 5;    // 일부 파일은 11일 수 있음
  let idxEmpl = 6;
  let idxName = 7;
  let idxRank = 8;
  let idxPosnType = 9;
  let idxPosn = 10;
  let idxGisu = -1;

  try {
    // 헤더 후보 영역(상위 10행)에서 각 컬럼 라벨 위치 탐색
    const headerScanRows = jsonData.slice(0, 10) as any[][];


    for (const row of headerScanRows) {
      if (!Array.isArray(row)) continue;
      // 공백/줄바꿈/마침표 등을 정규화하여 라벨 감지 안정화
      const normalize = (s: string) => s
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .replace(/[.]/g, '')
        .trim();
      const upper = row.map((c: any) => (typeof c === 'string' ? normalize(c) : c));

      // 스케줄 본문 라벨
      if (upper.includes('DATE')) {
        idxDate = upper.indexOf('DATE');
      }
      if (upper.includes('FLIGHT')) {
        idxFlight = upper.indexOf('FLIGHT');
      }
      // "SHOW UP" 또는 "SHOWUP" 모두 허용
      const showUpIdx = upper.findIndex((v: any) =>
        typeof v === 'string' && (v === 'SHOW UP' || v === 'SHOWUP' || v.includes('SHOW')));
      if (showUpIdx >= 0) {
        idxShowUp = showUpIdx;
      }
      if (upper.includes('SECTOR')) {
        idxSector = upper.indexOf('SECTOR');
      }
      if (upper.includes('STD')) {
        idxSTD = upper.indexOf('STD');
      }
      if (upper.includes('STA')) {
        idxSTA = upper.indexOf('STA');
      }
      const hasEmpl = upper.includes('EMPL');
      const hasName = upper.includes('NAME');
      const hasRank = upper.includes('RANK');
      const hasPosnType = upper.includes('POSN TYP') || upper.includes('POSN TYPE') || upper.includes('POSNTYPE');
      const hasPosn = upper.includes('POSN');
      const gisuIndexCandidate = upper.findIndex((value: any) => typeof value === 'string' && value.replace(/\s+/g, '').replace(/-/g, '') === 'GISU');
      if (hasEmpl && hasName) {
        if (hasEmpl) {
          idxEmpl = upper.indexOf('EMPL');
        }
        if (hasName) {
          idxName = upper.indexOf('NAME');
        }
        if (hasRank) {
          idxRank = upper.indexOf('RANK');
        }
        if (hasPosnType) idxPosnType = upper.indexOf('POSN TYP') !== -1 ? upper.indexOf('POSN TYP') : (upper.indexOf('POSN TYPE') !== -1 ? upper.indexOf('POSN TYPE') : upper.indexOf('POSNTYPE'));
        if (hasPosn) idxPosn = upper.indexOf('POSN');
        if (gisuIndexCandidate !== -1) idxGisu = gisuIndexCandidate;
        // 크루 헤더만 찾았다고 루프를 중단하지 말고, 다른 라벨도 계속 스캔
      }
    }

    // 일부 파일 포맷에서 스케줄 라벨이 감지되지 않으면 보수적 폴백 사용
    if (idxFlight === -1 && jsonData[4]) idxFlight = 1;
    if (idxSector === -1 && jsonData[4]) idxSector = 3;
    if (idxSTD === -1 && jsonData[4]) idxSTD = 4;
    if (idxSTA === -1 && jsonData[4]) idxSTA = 5;
    if (idxEmpl === -1) idxEmpl = 6;
    if (idxName === -1) idxName = 7;
    if (idxRank === -1) idxRank = 8;
    if (idxPosnType === -1) idxPosnType = 9;
    if (idxPosn === -1) idxPosn = 10;
    if (idxGisu === -1) idxGisu = -1;


  } catch (e) {
    console.warn('⚠️ 크루 컬럼 인덱스 자동 감지 실패, 기본 인덱스 사용', e);
  }

  // 해당 월의 말일까지 필터링 (UTC 메서드 사용)
  const currentMonth = new Date().getUTCMonth() + 1; // 1-12
  const currentYear = new Date().getUTCFullYear();
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();

  // 비행 데이터를 stateful하게 파싱하고 병합
  const flightsMap = new Map<string, Flight>();
  let lastFlightKey: string | null = null;
  let lastDate: string = new Date().toISOString().split('T')[0];

  dataRows.forEach((row, rowIndex) => {
    // 빈 행 건너뛰기
    if (row.length === 0 || !row.some(cell => cell)) {
      return;
    }

    const dateStr = row[idxDate] ? String(row[idxDate]).trim() : '';
    // 📌 감지된 인덱스 기반으로 안전하게 읽기
    let flightNumber = row[idxFlight] ? String(row[idxFlight]).trim() : '';
    const showUp = row[idxShowUp] ? String(row[idxShowUp]).trim() : '';
    let route = row[idxSector] ? String(row[idxSector]).trim() : '';
    const std = row[idxSTD] ? String(row[idxSTD]).trim() : '';
    const sta = row[idxSTA] ? String(row[idxSTA]).trim() : '';

    // Pattern, DAY OFF 등 유효하지 않은 항목 건너뛰기
    // ⚠️ flightNumber가 비어 있어도 아래의 "crew-only" 분기에서 사용되므로 여기서 걸러내지 않음
    if (flightNumber && (flightNumber.includes('Pattern') || flightNumber === 'Pattern' ||
      flightNumber.includes('DAY OFF'))) {
      return;
    }

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

    // 🔧 개선된 Crew 정보 파싱 (OZ 구조) - 컬럼 인덱스 동적 사용
    const crewMember: CrewMember = {
      empl: row[idxEmpl] ? String(row[idxEmpl]).trim() : '',
      name: row[idxName] ? String(row[idxName]).trim() : '',
      rank: row[idxRank] ? String(row[idxRank]).trim() : '',
      posnType: row[idxPosnType] ? String(row[idxPosnType]).trim() : '',
      posn: row[idxPosn] ? String(row[idxPosn]).trim() : '',
      gisu: idxGisu !== -1 && row[idxGisu] ? String(row[idxGisu]).trim() : ''
    };

    // 🔍 컬럼 데이터 디버깅 (첫 번째 행에서만)
    if (rowIndex === 0) {

    }

    // 🔧 크루 정보 파싱 단순화 - NAME만 있으면 크루로 인식
    const hasCockpitCrewInfo = !!(crewMember.name && crewMember.name.trim() !== '');

    // 🔧 월 비행스케줄에서는 캐빈 승무원 정보를 파싱하지 않음
    // 캐빈 승무원 정보는 브리핑 인포를 통해서만 업로드 가능
    const cabinCrewMember = null;
    const hasCabinCrewInfo = false;

    // 🔧 조종사 판별 조건 단순화 - NAME만 있으면 조종사로 간주
    const isCockpitCrew = (member: CrewMember) => {
      return member.name && member.name.trim() !== '';
    };

    // 객실 승무원 판별 조건
    const isCabinCrew = (member: CrewMember) => {
      return member.name &&
        (!member.empl || !member.empl.match(/^\d+$/)) &&
        (member.posn === 'F' || member.posn === 'A' || member.posn === 'B' ||
          member.posn === 'C' || member.rank === 'F' || member.rank === 'A' ||
          member.rank === 'B' || member.rank === 'C' || !member.rank);
    };

    // ✨ CREW 데이터 파싱 디버깅 (월 비행스케줄에서는 조종사만)
    if (hasCockpitCrewInfo) {
      // 디버깅용 로그 (테스트용)

    } else {
      // 크루 정보가 없는 경우도 로그로 확인

    }

    // 날짜 파싱 및 유지
    const dateMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\([월화수목금토일]\)$/);
    if (dateMatch) {
      const month = parseInt(dateMatch[1]);
      const day = parseInt(dateMatch[2]);
      lastDate = `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }

    // 모든 스케줄 타입을 개별적으로 판단
    const isFlightRow = flightNumber && flightNumber !== 'FLIGHT' && !flightNumber.includes('DAY OFF') &&
      !flightNumber.toUpperCase().includes('STBY') &&
      !flightNumber.toUpperCase().includes('STANDBY') &&
      !flightNumber.toUpperCase().includes('RDO') &&
      !flightNumber.toUpperCase().includes('SIM') &&
      !flightNumber.toUpperCase().includes('G/S') &&
      !flightNumber.toUpperCase().includes('GS') &&
      !flightNumber.toUpperCase().includes('MEDICAL') &&
      !flightNumber.toUpperCase().includes('안전회의') &&
      !flightNumber.toUpperCase().includes('SAFETY') &&
      !flightNumber.toUpperCase().includes('TRAINING') &&
      !flightNumber.toUpperCase().includes('교육') &&
      !flightNumber.toUpperCase().includes('BRIEFING') &&
      !flightNumber.toUpperCase().includes('브리핑') &&
      !flightNumber.toUpperCase().includes('MEETING') &&
      !flightNumber.toUpperCase().includes('회의') &&
      !flightNumber.toUpperCase().includes('CHECK') &&
      !flightNumber.toUpperCase().includes('점검') &&
      !flightNumber.toUpperCase().includes('INSPECTION') &&
      !flightNumber.toUpperCase().includes('검사');

    const isStbyRow = flightNumber && (
      flightNumber.toUpperCase().includes('STBY') ||
      flightNumber.toUpperCase().includes('STANDBY') ||
      flightNumber.toUpperCase().includes('대기') ||
      flightNumber.toUpperCase().includes('STB') ||
      flightNumber.toUpperCase().includes('RESERVE') ||
      flightNumber.toUpperCase().includes('OTHRDUTY') ||
      flightNumber.toUpperCase().includes('HM_SBY04')
    );

    const isSpecialScheduleRow = flightNumber && (
      flightNumber.toUpperCase().includes('SIM') ||
      flightNumber.toUpperCase().includes('G/S') ||
      flightNumber.toUpperCase().includes('GS') ||
      flightNumber.toUpperCase().includes('MEDICAL') ||
      flightNumber.toUpperCase().includes('안전회의') ||
      flightNumber.toUpperCase().includes('SAFETY') ||
      flightNumber.toUpperCase().includes('TRAINING') ||
      flightNumber.toUpperCase().includes('교육') ||
      flightNumber.toUpperCase().includes('BRIEFING') ||
      flightNumber.toUpperCase().includes('브리핑') ||
      flightNumber.toUpperCase().includes('MEETING') ||
      flightNumber.toUpperCase().includes('회의') ||
      flightNumber.toUpperCase().includes('CHECK') ||
      flightNumber.toUpperCase().includes('점검') ||
      flightNumber.toUpperCase().includes('INSPECTION') ||
      flightNumber.toUpperCase().includes('검사')
    );

    // 모든 스케줄 타입을 파싱 (일반 비행편, STBY, 특별스케줄, SIM스케줄 모두)
    // 또는 같은 날짜/편명의 직전 비행편이 이미 시작되었고 이번 행이 크루만 있는 연속행인 경우에도 처리
    if (isFlightRow || isSpecialScheduleRow || isStbyRow || (lastFlightKey && !flightNumber && hasCockpitCrewInfo)) {
      // 같은 날짜에서 FLIGHT가 비어 있고 이전 행에서 이미 flightKey가 결정된 경우에는 기존 키를 유지
      if (!flightNumber && lastFlightKey) {
        // nothing
      } else {
        lastFlightKey = `${lastDate}-${flightNumber || route}`; // STANDBY 등을 위해 route도 키로 사용
      }

      // 기존 비행편이 있는지 확인
      const existingFlight = flightsMap.get(lastFlightKey);

      if (existingFlight) {
        // 기존 비행편이 있으면 승무원 정보만 추가 (개선된 로직)
        if (hasCockpitCrewInfo && isCockpitCrew(crewMember)) {
          // 중복 체크
          const isDuplicate = existingFlight.crew.some(existingCrew =>
            existingCrew.empl === crewMember.empl || existingCrew.name === crewMember.name
          );
          if (!isDuplicate) {
            existingFlight.crew.push(crewMember);
          }
        }
        // 월 비행스케줄에서는 캐빈 승무원 정보를 처리하지 않음
      } else {
        // STD/STA 날짜와 시간 파싱 (원본 데이터 그대로 사용)
        const stdParsed = parseDateTime(std, lastDate);
        const staParsed = parseDateTime(sta, lastDate);


        // isSpecialScheduleRow 변수를 재사용

        let departureDateTimeUtc: string | undefined;
        let arrivalDateTimeUtc: string | undefined;
        let showUpDateTimeUtc: string | undefined;

        // 모든 스케줄을 UTC로 변환 (국내선, 해외선, 특별스케줄, SIM스케줄 모두)
        try {
          if (route && route.includes('/')) {
            // 일반 비행편 (국내선/해외선)
            const utcTimes = convertLocalTimeToUTC(
              stdParsed.date, stdParsed.time,
              staParsed.date, staParsed.time,
              route
            );
            departureDateTimeUtc = utcTimes.departureDateTimeUtc;
            arrivalDateTimeUtc = utcTimes.arrivalDateTimeUtc;

            // Show Up 시간 계산 (ICN 출발인 경우만)
            if (departureDateTimeUtc) { // UTC 변환이 성공한 경우에만 Show Up 시간 계산
              showUpDateTimeUtc = calculateShowUpTime(stdParsed.date, stdParsed.time, route);
            }
          } else if (isSpecialScheduleRow) {
            // 특별스케줄과 SIM스케줄: 한국시간을 UTC로 변환
            // 한국시간(Asia/Seoul)을 UTC로 변환
            if (stdParsed.date && stdParsed.time && staParsed.date && staParsed.time) {
              const departureDateTimeString = `${stdParsed.date}T${stdParsed.time}`;
              const arrivalDateTimeString = `${staParsed.date}T${staParsed.time}`;

              const departureUtc = fromZonedTime(departureDateTimeString, 'Asia/Seoul');
              const arrivalUtc = fromZonedTime(arrivalDateTimeString, 'Asia/Seoul');

              // 유효한 Date 객체인지 확인 후 변환
              if (!isNaN(departureUtc.getTime()) && !isNaN(arrivalUtc.getTime())) {
                departureDateTimeUtc = departureUtc.toISOString();
                arrivalDateTimeUtc = arrivalUtc.toISOString();
              }
            }
          } else if (isStbyRow) {
            // STBY 스케줄: 한국시간을 UTC로 변환
            if (stdParsed.date && stdParsed.time && staParsed.date && staParsed.time) {
              const departureDateTimeString = `${stdParsed.date}T${stdParsed.time}`;
              const arrivalDateTimeString = `${staParsed.date}T${staParsed.time}`;

              const departureUtc = fromZonedTime(departureDateTimeString, 'Asia/Seoul');
              const arrivalUtc = fromZonedTime(arrivalDateTimeString, 'Asia/Seoul');

              // 유효한 Date 객체인지 확인 후 변환
              if (!isNaN(departureUtc.getTime()) && !isNaN(arrivalUtc.getTime())) {
                departureDateTimeUtc = departureUtc.toISOString();
                arrivalDateTimeUtc = arrivalUtc.toISOString();
              }
            }
          } else {
            // 기타 스케줄: 한국시간을 UTC로 변환
            if (stdParsed.date && stdParsed.time && staParsed.date && staParsed.time) {
              const departureDateTimeString = `${stdParsed.date}T${stdParsed.time}`;
              const arrivalDateTimeString = `${staParsed.date}T${staParsed.time}`;

              const departureUtc = fromZonedTime(departureDateTimeString, 'Asia/Seoul');
              const arrivalUtc = fromZonedTime(arrivalDateTimeString, 'Asia/Seoul');

              // 유효한 Date 객체인지 확인 후 변환
              if (!isNaN(departureUtc.getTime()) && !isNaN(arrivalUtc.getTime())) {
                departureDateTimeUtc = departureUtc.toISOString();
                arrivalDateTimeUtc = arrivalUtc.toISOString();
              }
            }
          }
        } catch (error) {
          console.error(`❌ 시간 변환 오류 - ${flightNumber}:`, error);
          // 오류 발생 시 UTC 시간을 undefined로 설정
          departureDateTimeUtc = undefined;
          arrivalDateTimeUtc = undefined;
          showUpDateTimeUtc = undefined;
        }

        // HLNO 데이터 추출 (row[20]에서 regNo 추출)
        const regNo = row[20] ? String(row[20]).trim() : null;

        // 새로운 비행편 생성
        const newFlight: Flight = {
          id: Math.floor(Math.random() * 1000000) + rowIndex,
          date: lastDate, // 기본 날짜 (출발일)
          departureDateTimeUtc, // ISO 8601 형식 출발일시 UTC
          arrivalDateTimeUtc, // ISO 8601 형식 도착일시 UTC
          flightNumber: flightNumber,
          route: route,
          block: 0,
          status: { departed: false, landed: false },
          crew: [],
          regNo: regNo || null, // HLNO 데이터를 regNo로 저장
          cabinCrew: [] // CABIN CREW 데이터를 위한 빈 배열 초기화
        };

        // showUpDateTimeUtc가 undefined가 아닌 경우에만 추가
        if (showUpDateTimeUtc) {
          newFlight.showUpDateTimeUtc = showUpDateTimeUtc;
        }



        // 조종사 정보 추가 (개선된 로직)
        if (hasCockpitCrewInfo && isCockpitCrew(crewMember)) {
          newFlight.crew.push(crewMember);
        }

        // 월 비행스케줄에서는 캐빈 승무원 정보를 처리하지 않음

        flightsMap.set(lastFlightKey, newFlight);
      }
    }
    // Crew 정보만 있는 행 (비행편 정보가 없는 경우) - 조종사 정보만 처리
    else if (lastFlightKey && hasCockpitCrewInfo) {
      const existingFlight = flightsMap.get(lastFlightKey);
      if (existingFlight && isCockpitCrew(crewMember)) {
        // 중복 체크
        const isDuplicate = existingFlight.crew.some(existingCrew =>
          existingCrew.empl === crewMember.empl || existingCrew.name === crewMember.name
        );
        if (!isDuplicate) {
          existingFlight.crew.push(crewMember);
        }
      }
    }
  });

  // DAY OFF, Pattern 같은 유효하지 않은 항목 필터링
  const flights = Array.from(flightsMap.values()).filter(flight => {
    const isDayOff = flight.flightNumber.includes('DAY OFF');
    const isPattern = flight.flightNumber.includes('Pattern') || flight.flightNumber === 'Pattern';
    const isEmptyFlightNumber = !flight.flightNumber || flight.flightNumber.trim() === '';
    return !isDayOff && !isPattern && !isEmptyFlightNumber;
  });


  // 월별 총 BLOCK 시간 정보를 모든 비행 데이터에 추가 (KE와 동일한 방식)
  if (flights.length > 0 && monthlyTotalBlock !== '00:00') {
    flights.forEach((flight) => {
      flight.monthlyTotalBlock = monthlyTotalBlock;
    });
  }

  // BRIEFING INFO 데이터를 기존 스케줄과 병합
  if (isBriefingFormat && briefingFlightDate && briefingFlightNumber) {
    // 해당 날짜와 편명의 기존 스케줄 찾기
    const targetFlight = flights.find(flight =>
      flight.date === briefingFlightDate &&
      flight.flightNumber === briefingFlightNumber
    );

    if (targetFlight) {
      // 기존 스케줄에 브리핑 정보 병합
      if (briefingRegNo) {
        targetFlight.regNo = briefingRegNo;
      }

      // 🔧 기존 데이터 정리: 잘못 저장된 캐빈 승무원을 crew에서 제거하고 cabinCrew로 이동
      if (targetFlight.crew && targetFlight.crew.length > 0) {
        const cockpitCrew: CrewMember[] = [];
        const movedCabinCrew: CrewMember[] = [];

        targetFlight.crew.forEach(crewMember => {
          // 단순화된 조종사 판별 조건 사용
          const isCockpitCrewMember = crewMember.empl &&
            crewMember.empl.match(/^\d+$/) &&
            crewMember.name;

          if (isCockpitCrewMember) {
            cockpitCrew.push(crewMember);
          } else {
            // 캐빈 승무원으로 이동 (EMPL이 없거나 조종사가 아닌 경우)
            movedCabinCrew.push(crewMember);
          }
        });

        // 정리된 데이터로 업데이트
        targetFlight.crew = cockpitCrew;
        targetFlight.cabinCrew = targetFlight.cabinCrew || [];
        targetFlight.cabinCrew.push(...movedCabinCrew);
      }

      // 캐빈 승무원 정보 병합 (기존 정보 유지하면서 추가)
      if (briefingCabinCrew.length > 0) {
        targetFlight.cabinCrew = targetFlight.cabinCrew || [];
        briefingCabinCrew.forEach(briefingCrew => {
          const isDuplicate = targetFlight.cabinCrew!.some(existingCrew =>
            existingCrew.empl === briefingCrew.empl || existingCrew.name === briefingCrew.name
          );
          if (!isDuplicate) {
            targetFlight.cabinCrew!.push(briefingCrew);
          }
        });
      }

      // 조종사 정보 병합 (기존 정보 유지하면서 추가)
      if (briefingCockpitCrew.length > 0) {
        targetFlight.crew = targetFlight.crew || [];
        briefingCockpitCrew.forEach(briefingCrew => {
          const isDuplicate = targetFlight.crew!.some(existingCrew =>
            existingCrew.empl === briefingCrew.empl || existingCrew.name === briefingCrew.name
          );
          if (!isDuplicate) {
            targetFlight.crew!.push(briefingCrew);
          }
        });
      }
    } else {
      // 해당 스케줄이 없으면 브리핑 정보만으로 새 스케줄 생성
      const briefingFlight: Flight = {
        id: Math.floor(Math.random() * 1000000),
        date: briefingFlightDate,
        flightNumber: briefingFlightNumber,
        route: '',
        block: 0,
        status: { departed: false, landed: false },
        crew: briefingCockpitCrew,
        regNo: briefingRegNo || null,
        cabinCrew: briefingCabinCrew
      };

      flights.push(briefingFlight);
    }
  }

  return flights;
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
