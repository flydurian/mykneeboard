import { Flight } from '../types';
import { parse7CFile } from './companyParsers/7cParser';

// PDF 파일에서 비행 데이터를 추출하고 정리하는 함수 (회사별 라우터)
export const parsePDFFile = (file: File, userCompany?: string, userName?: string, empl?: string): Promise<Flight[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      // 회사별 파서 결정 (기본값: OZ)
      const company = userCompany || 'OZ';
      
      let flights: Flight[] = [];
      
      // 7C만 PDF 파서 지원
      if (company === '7C') {
        flights = await parse7CFile(file);
      } else {
        throw new Error(`${company} 항공사는 PDF 파일을 지원하지 않습니다. Excel 파일을 사용해주세요.`);
      }
      resolve(flights);
      
    } catch (error) {
      console.error('PDF 파싱 오류:', error);
      reject(new Error(`PDF 파일 파싱에 실패했습니다: ${error}`));
    }
  });
};
