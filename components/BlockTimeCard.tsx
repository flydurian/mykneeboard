
import React from 'react';
import { Flight } from '../types';

interface BlockTimeCardProps {
    flights: Flight[];
    todayStr: string;
    onMonthClick: (month: number, flights: Flight[]) => void;
}

const BlockTimeCard: React.FC<BlockTimeCardProps> = ({ flights = [], todayStr, onMonthClick }) => {
    const today = new Date(todayStr);
    const currentMonth = today.getMonth();
    const nextMonth = (currentMonth + 1) % 12;
    const currentYear = today.getFullYear();
    
    // 다음 달이 1월인 경우 연도 조정
    const nextYear = nextMonth === 0 ? currentYear + 1 : currentYear;

    // 현재 달과 다음 달의 비행 데이터 필터링 (연도 고려)
    const currentMonthFlights = flights.filter(flight => {
        const flightDate = new Date(flight.date);
        return flightDate.getMonth() === currentMonth && flightDate.getFullYear() === currentYear;
    });

    const nextMonthFlights = flights.filter(flight => {
        const flightDate = new Date(flight.date);
        return flightDate.getMonth() === nextMonth && flightDate.getFullYear() === nextYear;
    });

    // DUTY 시간 추출 함수
    const getDutyTime = (monthFlights: Flight[]): string => {
        if (monthFlights.length === 0) {
            return '00:00';
        }

        // 해당 월의 첫 번째 비행에서 monthlyTotalBlock 확인
        const flightWithDuty = monthFlights.find(flight => flight.monthlyTotalBlock && flight.monthlyTotalBlock > 0);
        if (flightWithDuty && flightWithDuty.monthlyTotalBlock) {
            const totalHours = flightWithDuty.monthlyTotalBlock;
            const hours = Math.floor(totalHours);
            const minutes = Math.round((totalHours - hours) * 60);
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }

        // monthlyTotalBlock이 없으면 00:00 반환
        return '00:00';
    };

    const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
    
    const currentMonthDuty = getDutyTime(currentMonthFlights);
    const nextMonthDuty = getDutyTime(nextMonthFlights);

    return (
        <div className="grid grid-cols-2 gap-6">
            {/* 현재 달 카드 */}
            <div 
                onClick={() => onMonthClick(currentMonth, currentMonthFlights)}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 text-center cursor-pointer transform hover:scale-105 transition-transform duration-300"
            >
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{monthNames[currentMonth]} 비행시간</p>
                <p className="text-4xl font-bold my-1 text-gray-800 dark:text-gray-200">{currentMonthDuty}</p>
            </div>

            {/* 다음 달 카드 */}
            <div 
                onClick={() => onMonthClick(nextMonth, nextMonthFlights)}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 text-center cursor-pointer transform hover:scale-105 transition-transform duration-300"
            >
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{monthNames[nextMonth]} 비행시간</p>
                <p className="text-4xl font-bold my-1 text-gray-800 dark:text-gray-200">{nextMonthDuty}</p>
            </div>
        </div>
    );
};

export default BlockTimeCard;
