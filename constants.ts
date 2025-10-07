
import { Flight } from './types';
import { toZonedTime, format } from 'date-fns-tz';

// 샘플 데이터 삭제 - Firebase 데이터베이스의 실제 데이터만 사용

// 오늘 날짜를 YYYY-MM-DD 형식으로 반환하는 함수 (한국 시간 기준)
export const getTodayString = (): string => {
  const KOREA_TIME_ZONE = 'Asia/Seoul';
  const now = new Date();
  const koreaTime = toZonedTime(now, KOREA_TIME_ZONE);
  return format(koreaTime, 'yyyy-MM-dd', { timeZone: KOREA_TIME_ZONE });
};

