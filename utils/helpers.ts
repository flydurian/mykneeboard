
import { Flight, DDayInfo, CurrencyInfo } from '../types';

export const calculateDday = (flightDateStr: string, todayStr: string): DDayInfo => {
  const today = new Date(todayStr); 
  today.setHours(0, 0, 0, 0);
  const flightDate = new Date(flightDateStr); 
  flightDate.setHours(0, 0, 0, 0);
  const diffTime = flightDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { text: '오늘', days: 0 };
  if (diffDays > 0) return { text: `${diffDays}일 후`, days: diffDays };
  return { text: `${Math.abs(diffDays)}일 전`, days: diffDays };
};

export const calculateCurrency = (flights: Flight[], type: 'takeoff' | 'landing', todayStr: string): CurrencyInfo => {
    const today = new Date(todayStr);
    const sixtyDaysAgo = new Date(today); 
    sixtyDaysAgo.setDate(today.getDate() - 60);

    const recentEvents = flights
      .filter(f => {
        const flightDate = new Date(f.date);
        return flightDate >= sixtyDaysAgo && flightDate <= today;
      })
      .filter(f => type === 'takeoff' ? f.status.departed : f.status.landed)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const count = recentEvents.length;
    const isCurrent = count >= 3;
    let expiryDate: string | null = null;
    let daysUntilExpiry: number | null = null;

    if (isCurrent) {
        const thirdEventDate = new Date(recentEvents[2].date);
        const expiryDateObj = new Date(thirdEventDate);
        expiryDateObj.setDate(thirdEventDate.getDate() + 60);
        expiryDate = expiryDateObj.toLocaleDateString('ko-KR');
        daysUntilExpiry = Math.ceil((expiryDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
    return { count, isCurrent, expiryDate, daysUntilExpiry, recentEvents };
};

export const formatTime = (totalMinutes: number): string => {
    if (totalMinutes === 0) return '00:00';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};
