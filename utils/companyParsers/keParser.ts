import { Flight, CrewMember } from '../../types';
import { fromZonedTime, format } from 'date-fns-tz';
import { getTimezone } from '../cityData';

// Show Up 시간을 계산하는 함수 (한국 공항 출발 시, 출발시간에서 1시간 35분 빼기)
const calculateShowUpTime = (departureDate: string, departureTime: string, route: string): string | undefined => {
  try {
    const [depAirport] = route.split('/');

    // 한국 공항 목록
    const koreanAirports = ['ICN', 'GMP', 'PUS', 'CJU', 'TAE', 'CJJ'];

    if (!depAirport || !koreanAirports.includes(depAirport.toUpperCase())) {
      return undefined;
    }

    const depTz = getTimezone(depAirport);
    if (!depTz) {
      return undefined;
    }

    const departureDateTimeString = `${departureDate}T${departureTime}`;
    const departureUtc = fromZonedTime(departureDateTimeString, depTz);

    // Show Up 시간 계산 (1시간 35분 = 95분 빼기)
    const showUpUtc = new Date(departureUtc.getTime() - 95 * 60 * 1000);

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

    const departureDateTimeString = `${departureDate}T${departureTime}`;
    const departureUtc = fromZonedTime(departureDateTimeString, depTz);

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

// STD/STA에서 날짜와 시간 분리 ("2026-02-04 18:53" → date: "2026-02-04", time: "18:53")
const parseStdSta = (raw: string): { date: string, time: string } => {
  if (!raw) return { date: '', time: '' };
  // "YYYY-MM-DD HH:MM" 또는 "YYYY-MM-DD HH:MM:SS" 형식
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})/);
  if (match) return { date: match[1], time: match[2].length === 4 ? '0' + match[2] : match[2] };
  // "HH:MM" 만 있는 경우
  const timeOnly = raw.match(/^(\d{1,2}:\d{2})$/);
  if (timeOnly) return { date: '', time: timeOnly[1].length === 4 ? '0' + timeOnly[1] : timeOnly[1] };
  return { date: '', time: '' };
};

// 암호화된 데이터인지 확인
const isEncryptedData = (str: string) => /^[A-Za-z0-9+/=]+$/.test(str) && str.length > 20;

// 대한항공(KE) 전용 엑셀 파싱 함수
// 형식: Flight/Activity | From | STD | To | STA | A/C | Acting rank | Duty | PIC code | Crew ID | Name | Comment | Special Duty Code
export const parseKEExcel = (jsonData: any[][], userName?: string, empl?: string): { flights: Flight[], monthlyTotalBlock: string, scheduleMonth?: number, scheduleYear?: number } => {

  // ExcelJS richText 객체에서 텍스트 추출 헬퍼
  const extractCellText = (cell: any): string => {
    if (cell === null || cell === undefined) return '';
    if (typeof cell === 'string') return cell.trim();
    if (typeof cell === 'number') return String(cell);
    // ExcelJS richText 형식: { richText: [{ text: "..." }, ...] }
    if (cell && cell.richText && Array.isArray(cell.richText)) {
      return cell.richText.map((rt: any) => rt.text || '').join('').trim();
    }
    // ExcelJS result 형식: { result: "..." }
    if (cell && cell.result !== undefined) return String(cell.result).trim();
    return String(cell).trim();
  };

  // 모든 셀을 문자열로 전처리
  const data: string[][] = jsonData.map(row =>
    Array.isArray(row) ? row.map(extractCellText) : []
  );

  // 헤더 감지
  let headerRowIndex = -1;
  let flightActivityCol = -1;
  let fromCol = -1;
  let stdCol = -1;
  let toCol = -1;
  let staCol = -1;
  let acCol = -1;
  let actingRankCol = -1;
  let crewIdCol = -1;
  let nameCol = -1;
  let commentCol = -1;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const rowStr = row.join(' ').toLowerCase();

    // 헤더 감지: "flight" + "from" + "std" + "sta"
    if ((rowStr.includes('flight') || rowStr.includes('activity')) && rowStr.includes('from') && rowStr.includes('std') && rowStr.includes('sta')) {
      headerRowIndex = i;

      row.forEach((cellStr, colIndex) => {
        const lc = cellStr.toLowerCase();

        if (lc.includes('flight') || lc === 'flight/activity') {
          flightActivityCol = colIndex;
        } else if (lc === 'from') {
          fromCol = colIndex;
        } else if (lc === 'std') {
          stdCol = colIndex;
        } else if (lc === 'to') {
          toCol = colIndex;
        } else if (lc === 'sta') {
          staCol = colIndex;
        } else if (lc === 'a/c' || lc === 'ac' || lc.includes('a/c')) {
          acCol = colIndex;
        } else if (lc.includes('acting') || (lc.includes('rank') && !lc.includes('pic'))) {
          actingRankCol = colIndex;
        } else if (lc.includes('crew') && lc.includes('id')) {
          crewIdCol = colIndex;
        } else if (lc === 'name') {
          nameCol = colIndex;
        } else if (lc === 'comment') {
          commentCol = colIndex;
        }
      });
      break;
    }
  }

  if (headerRowIndex === -1 || flightActivityCol === -1) {
    console.error('KE 엑셀 헤더를 찾을 수 없습니다. (Flight/Activity | From | STD | To | STA 형식 필요)');
    return { flights: [], monthlyTotalBlock: '00:00' };
  }

  console.log('📋 KE 엑셀 헤더 감지:', {
    headerRowIndex,
    flightActivityCol, fromCol, stdCol, toCol, staCol, acCol, actingRankCol, crewIdCol, nameCol
  });

  // 헤더 이전 행들에서 사용자 정보 및 월간 총 비행시간 추출
  let foundUserName = '';
  let foundEmpl = '';
  let foundRank = 'FO';
  let monthlyTotalBlock = '00:00';
  let scheduleMonth: number | undefined;
  let scheduleYear: number | undefined;

  for (let i = 0; i < headerRowIndex; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    for (let j = 0; j < row.length; j++) {
      const cellValue = row[j] || '';
      if (!cellValue) continue;

      // 파이프(|)로 구분된 사용자 정보 찾기 (예: "LEE JAEKYU |1702142 | 330 | ICN | FO")
      if (cellValue.includes('|')) {
        const parts = cellValue.split('|').map(part => part.trim());
        if (parts.length >= 4) {
          if (parts[0] && !/^\d+$/.test(parts[0])) {
            foundUserName = parts[0];
            foundEmpl = parts[1] || '';
            if (parts.length >= 5) {
              foundRank = parts[4] || 'FO';
            }
          }
        }
      }

      // 비행시간 정보 찾기 (예: "FLY 45:59 TVL 00:00 DO 9 RESERVE 2")
      if (cellValue.includes('FLY') && cellValue.includes(':')) {
        const flyMatch = cellValue.match(/FLY\s+(\d{1,3}):(\d{2})/);
        if (flyMatch) {
          const hours = parseInt(flyMatch[1]);
          const minutes = parseInt(flyMatch[2]);
          monthlyTotalBlock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }
      }
    }
  }

  // 전달받은 정보가 있으면 우선 사용
  if (userName && !isEncryptedData(userName)) foundUserName = userName;
  if (empl && !isEncryptedData(empl)) foundEmpl = empl;

  console.log('👤 KE 사용자 정보:', { foundUserName, foundEmpl, foundRank, monthlyTotalBlock });

  // 데이터 행 파싱
  const dataRows = data.slice(headerRowIndex + 1);
  const flights: Flight[] = [];

  // 현재 비행편 정보 (같은 편의 CAP/FO 행을 병합하기 위해)
  let currentFlight: {
    flightNumber: string;
    from: string;
    to: string;
    acType: string;
    crew: CrewMember[];
    stdDate: string;
    stdTime: string;
    staDate: string;
    staTime: string;
    comment: string;
  } | null = null;

  const saveFlight = () => {
    if (!currentFlight || !currentFlight.flightNumber) return;

    // 본인이 탑승하는 비행편인지 확인 (empl이 설정된 경우만 필터링)
    if (foundEmpl) {
      const isMyFlight = currentFlight.crew.some(c => c.empl === foundEmpl);
      if (!isMyFlight) return;
    }

    const route = currentFlight.from && currentFlight.to
      ? `${currentFlight.from}/${currentFlight.to}` : '';

    // UTC 시간 변환
    let departureDateTimeUtc: string | undefined;
    let arrivalDateTimeUtc: string | undefined;
    let showUpDateTimeUtc: string | undefined;

    if (route.includes('/') && currentFlight.stdTime && currentFlight.staTime) {
      const utcTimes = convertLocalTimeToUTC(
        currentFlight.stdDate, currentFlight.stdTime,
        currentFlight.staDate, currentFlight.staTime,
        route
      );
      departureDateTimeUtc = utcTimes.departureDateTimeUtc;
      arrivalDateTimeUtc = utcTimes.arrivalDateTimeUtc;

      if (departureDateTimeUtc) {
        showUpDateTimeUtc = calculateShowUpTime(currentFlight.stdDate, currentFlight.stdTime, route);
      }
    }

    // Block 시간 계산 (분 단위)
    let block = 0;
    if (departureDateTimeUtc && arrivalDateTimeUtc) {
      const depMs = new Date(departureDateTimeUtc).getTime();
      const arrMs = new Date(arrivalDateTimeUtc).getTime();
      if (arrMs > depMs) {
        block = Math.round((arrMs - depMs) / (60 * 1000));
      }
    }

    // 편명에서 KE 접두사 제거
    const flightNum = currentFlight.flightNumber.replace(/^KE/, '');

    const flight: Flight = {
      id: Math.floor(Math.random() * 1000000) + flights.length,
      date: currentFlight.stdDate,
      departureDateTimeUtc,
      arrivalDateTimeUtc,
      flightNumber: flightNum,
      route,
      std: currentFlight.stdTime,
      sta: currentFlight.staTime,
      block,
      status: { departed: false, landed: false },
      crew: currentFlight.crew,
      scheduleType: 'FLIGHT',
      acType: currentFlight.acType || null,
      monthlyTotalBlock,
    };

    if (showUpDateTimeUtc) {
      flight.showUpDateTimeUtc = showUpDateTimeUtc;
    }

    flights.push(flight);
  };

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!Array.isArray(row) || row.length === 0 || !row.some(cell => cell)) continue;

    // 하단 헤더 행 감지
    const rowStr = row.join(' ').toLowerCase();
    if ((rowStr.includes('flight') || rowStr.includes('activity')) && rowStr.includes('from') && rowStr.includes('std') && rowStr.includes('sta')) {
      continue;
    }

    const flightActivity = row[flightActivityCol] || '';
    const from = fromCol >= 0 ? (row[fromCol] || '') : '';
    const stdRaw = stdCol >= 0 ? (row[stdCol] || '') : '';
    const to = toCol >= 0 ? (row[toCol] || '') : '';
    const staRaw = staCol >= 0 ? (row[staCol] || '') : '';
    const acType = acCol >= 0 ? (row[acCol] || '') : '';
    const actingRank = actingRankCol >= 0 ? (row[actingRankCol] || '') : '';
    const crewId = crewIdCol >= 0 ? (row[crewIdCol] || '') : '';
    const crewName = nameCol >= 0 ? (row[nameCol] || '') : '';
    const comment = commentCol >= 0 ? (row[commentCol] || '') : '';

    // Flight/Activity에 KE 편명이 있는 행 → 새로운 비행편 시작
    if (flightActivity && flightActivity.match(/^KE\d+/)) {
      // 이전 비행편 저장
      saveFlight();

      const stdParsed = parseStdSta(stdRaw);
      const staParsed = parseStdSta(staRaw);

      // 스케줄 월/년 추출 (첫 비행편의 날짜 기준)
      if (!scheduleMonth && stdParsed.date) {
        const dateParts = stdParsed.date.split('-');
        scheduleYear = parseInt(dateParts[0]);
        scheduleMonth = parseInt(dateParts[1]);
      }

      currentFlight = {
        flightNumber: flightActivity,
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        acType,
        crew: [],
        stdDate: stdParsed.date,
        stdTime: stdParsed.time,
        staDate: staParsed.date || stdParsed.date,
        staTime: staParsed.time,
        comment,
      };

      // 이 행에 크루 정보가 있으면 추가
      if (crewName || crewId) {
        currentFlight.crew.push({
          empl: crewId,
          name: crewName,
          rank: actingRank || 'PILOT',
          posnType: actingRank || 'PILOT',
          posn: actingRank || 'PILOT',
        });
      }
    }
    // Flight/Activity가 비어있고, 크루 정보가 있는 행 → 같은 비행편의 추가 크루
    else if (!flightActivity && (crewName || crewId) && currentFlight) {
      currentFlight.crew.push({
        empl: crewId,
        name: crewName,
        rank: actingRank || 'PILOT',
        posnType: actingRank || 'PILOT',
        posn: actingRank || 'PILOT',
      });
    }
  }

  // 마지막 비행편 저장
  saveFlight();

  console.log(`✅ KE 엑셀 파싱 완료: ${flights.length}편의 비행 데이터`);

  return { flights, monthlyTotalBlock, scheduleMonth, scheduleYear };
};
