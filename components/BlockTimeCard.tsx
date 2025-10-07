
import React, { memo, useMemo, useCallback } from 'react';
import { Flight } from '../types';

interface BlockTimeCardProps {
    flights: Flight[];
    todayStr: string;
    onMonthClick: (month: number, flights: Flight[]) => void;
}

const BlockTimeCard: React.FC<BlockTimeCardProps> = memo(({ flights = [], todayStr, onMonthClick }) => {
    const today = new Date(todayStr);
    const currentMonth = today.getMonth();
    const nextMonth = (currentMonth + 1) % 12;
    const currentYear = today.getFullYear();
    
    // 다음 달이 1월인 경우 연도 조정
    const nextYear = nextMonth === 0 ? currentYear + 1 : currentYear;


    // 현재 달과 다음 달의 비행 데이터 필터링 (연도 고려) - useMemo로 최적화
    const { currentMonthFlights, nextMonthFlights } = useMemo(() => {
        const currentMonthFlights = flights.filter(flight => {
            const flightDate = new Date(flight.date);
            return flightDate.getMonth() === currentMonth && flightDate.getFullYear() === currentYear;
        });

        const nextMonthFlights = flights.filter(flight => {
            const flightDate = new Date(flight.date);
            return flightDate.getMonth() === nextMonth && flightDate.getFullYear() === nextYear;
        });

        return { currentMonthFlights, nextMonthFlights };
    }, [flights, currentMonth, currentYear, nextMonth, nextYear]);

    // DUTY 시간 추출 함수 - useMemo로 최적화
    const getDutyTime = useCallback((monthFlights: Flight[]): string => {
        if (monthFlights.length === 0) {
            return '00:00';
        }

        // monthlyTotalBlock이 있으면 우선 사용 (OZ, KE 등에서 제공)
        const firstFlightWithMonthlyTotal = monthFlights.find(flight => flight.monthlyTotalBlock && flight.monthlyTotalBlock !== '00:00');
        if (firstFlightWithMonthlyTotal) {
            // monthlyTotalBlock이 이미 HH:MM 형식으로 저장됨
            return firstFlightWithMonthlyTotal.monthlyTotalBlock;
        }

        // monthlyTotalBlock이 없으면 개별 비행의 block 시간을 합산
        const totalBlockMinutes = monthFlights.reduce((total, flight) => {
            if (flight.block && flight.block > 0) {
                return total + flight.block;
            }
            return total;
        }, 0);
        
        if (totalBlockMinutes > 0) {
            const hours = Math.floor(totalBlockMinutes / 60);
            const minutes = totalBlockMinutes % 60;
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }

        // 모든 방법이 실패하면 00:00 반환
        return '00:00';
    }, []);

    const monthNames = useMemo(() => ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"], []);
    
    const { currentMonthDuty, nextMonthDuty } = useMemo(() => ({
        currentMonthDuty: getDutyTime(currentMonthFlights),
        nextMonthDuty: getDutyTime(nextMonthFlights)
    }), [currentMonthFlights, nextMonthFlights]);

    // 클릭 핸들러 최적화
    const handleCurrentMonthClick = useCallback(() => {
        onMonthClick(currentMonth, currentMonthFlights);
    }, [onMonthClick, currentMonth, currentMonthFlights]);

    const handleNextMonthClick = useCallback(() => {
        onMonthClick(nextMonth, nextMonthFlights);
    }, [onMonthClick, nextMonth, nextMonthFlights]);

    return (
        <div className="grid grid-cols-2 gap-6">
                {/* 현재 달 카드 */}
                <div 
                    onClick={handleCurrentMonthClick}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 text-center cursor-pointer"
                >
                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{monthNames[currentMonth]} 비행시간</p>
                    <p className="text-4xl font-bold my-1 text-gray-800 dark:text-gray-200">{currentMonthDuty}</p>
                </div>

                {/* 다음 달 카드 */}
                <div 
                    onClick={handleNextMonthClick}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 text-center cursor-pointer"
                >
                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{monthNames[nextMonth]} 비행시간</p>
                    <p className="text-4xl font-bold my-1 text-gray-800 dark:text-gray-200">{nextMonthDuty}</p>
                </div>
            </div>
    );
});

BlockTimeCard.displayName = 'BlockTimeCard';

export default BlockTimeCard;
