import * as ExcelJS from 'exceljs';
import { Flight } from '../types';
import { parseOZExcel } from './companyParsers/ozParser';
import { parseKEExcel } from './companyParsers/keParser';
import { auth } from '../src/firebase/config';

// Excel 파일에서 비행 데이터를 추출하고 정리하는 함수
export const parseExcelFile = (file: File, userCompany?: string, userName?: string, empl?: string): Promise<Flight[]> => {
  return new Promise(async (resolve, reject) => {
    console.log('🚀 Excel 파서 시작 (ExcelJS):', {
      fileName: file.name,
      userCompany,
      userName,
      empl
    });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      console.log('📖 Excel 파일 읽기 완료');

      // 첫 번째 시트 사용
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error('Excel 파일에 시트가 없습니다.');
      }

      console.log('📊 시트 정보:', { sheetName: worksheet.name });

      // JSON으로 변환 (2D 배열)
      const jsonData: any[][] = [];
      worksheet.eachRow({ includeEmpty: true }, (row, _rowNumber) => {
        // ExcelJS의 row.values는 1-based index로 인해 0번 인덱스가 비어있거나 undefined일 수 있음
        // 배열로 변환 후 0번 인덱스 제거 (만약 존재한다면)
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        jsonData.push(values);
      });

      console.log('📋 JSON 변환 완료:', {
        totalRows: jsonData.length,
        firstRow: jsonData[0],
        secondRow: jsonData[1]
      });

      // 회사별 파서 결정 (기본값: OZ)
      const company = userCompany || 'OZ';
      console.log('🏢 회사 파서 결정:', company);

      let flights: Flight[] = [];

      // 현재 사용자 정보 가져오기
      const user = auth.currentUser;

      // 회사별 파서 호출
      switch (company) {
        case 'OZ':
          console.log('🔍 OZ 파서 호출 시작:', {
            company,
            jsonDataLength: jsonData.length,
            firstRow: jsonData[0],
            userId: user?.uid
          });
          flights = parseOZExcel(jsonData, user?.uid);
          console.log('✅ OZ 파서 완료:', {
            flightsCount: flights.length,
            firstFlight: flights[0]
          });
          break;
        case 'KE':
          const keResult = parseKEExcel(jsonData, userName, empl);
          flights = keResult.flights;
          // KE 파서에서 이미 각 flight에 조건부로 monthlyTotalBlock이 설정됨
          // 추가로 설정할 필요 없음
          break;
        case '7C':
          throw new Error('제주항공(7C)은 Excel 파일을 지원하지 않습니다. PDF 파일을 사용해주세요.');
        default:
          console.warn(`알 수 없는 회사 코드: ${company}, OZ 파서 사용`);
          flights = parseOZExcel(jsonData);
      }

      resolve(flights);
    } catch (error) {
      console.error('Excel 파싱 오류:', error);
      reject(new Error('Excel 파일 파싱에 실패했습니다: ' + error));
    }
  });
};

