
import React from 'react';
import { Flight } from '../types';
import { calculateDday } from '../utils/helpers';
import StatusBadge from './StatusBadge';
import { getCityInfo } from '../utils/cityData';

interface FlightCardProps {
    flight: Flight | undefined;
    type: 'last' | 'next';
    onClick: (flight: Flight | undefined, type: 'last' | 'next') => void;
    todayStr: string;
}

const FlightCard: React.FC<FlightCardProps> = ({ flight, type, onClick, todayStr }) => {
    const handleClick = () => {
        onClick(flight, type);
    };

    if (!flight) {
        return (
            <div 
                onClick={handleClick}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center flex flex-col justify-center items-center h-full cursor-pointer transform hover:scale-105 transition-transform duration-300"
            >
                <p className="text-xl font-bold text-gray-400 dark:text-gray-500">
                    {type === 'next' ? '다음 비행 기록 없음' : '과거 비행 기록 없음'}
                </p>
            </div>
        );
    }

    const ddayInfo = (() => {
        if (type === 'last') {
            // 최근 비행: 출발지 로컬 날짜 기준으로 계산
            try {
                const departureAirport = flight.route.split('/')[0];
                const cityInfo = getCityInfo(departureAirport);
                
                if (cityInfo && flight.std) {
                    // 출발지 현지 날짜 계산
                    const [hours, minutes] = flight.std.split(':').map(Number);
                    const departureDateTime = new Date(flight.date);
                    departureDateTime.setHours(hours, minutes, 0, 0);
                    
                    // 출발지 현지 날짜로 변환
                    const localDepartureDate = new Date(departureDateTime.toLocaleString("en-US", { timeZone: cityInfo.timezone }));
                    const localDateStr = localDepartureDate.toLocaleDateString('en-CA'); // YYYY-MM-DD 형식
                    
                    // 현재 출발지 현지 날짜
                    const now = new Date();
                    const localNow = new Date(now.toLocaleString("en-US", { timeZone: cityInfo.timezone }));
                    const localTodayStr = localNow.toLocaleDateString('en-CA'); // YYYY-MM-DD 형식
                    
                    // 출발지 현지 날짜 기준으로 D-day 계산
                    const todayInLocal = new Date(localTodayStr);
                    const flightDateInLocal = new Date(localDateStr);
                    
                    const diffTime = flightDateInLocal.getTime() - todayInLocal.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays === 0) {
                        return { text: '오늘', days: 0 };
                    }
                    if (diffDays === 1) return { text: '내일', days: 1 };
                    if (diffDays > 0) return { text: `${diffDays}일 후`, days: diffDays };
                    if (diffDays === -1) return { text: '어제', days: -1 };
                    return { text: `${Math.abs(diffDays)}일 전`, days: diffDays };
                }
            } catch (error) {
                console.error('출발지 현지 날짜 계산 오류:', error);
            }
        }
        
        // 다음 비행이거나 계산 실패 시 기존 로직 사용
        return calculateDday(flight.date, todayStr, flight.std);
    })();
    const [origin, destination] = flight.route.split('/');
    const isNextFlight = type === 'next';
    const targetAirport = origin === 'ICN' ? destination : origin;

    return (
        <div 
            onClick={handleClick} 
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 text-center cursor-pointer transform hover:scale-105 transition-transform duration-300 flex flex-col justify-center h-full relative min-h-[120px] sm:min-h-[140px]"
        >
            {!isNextFlight && <StatusBadge status={flight.status} />}
            <div className="flex flex-col justify-center items-center h-full">
                <p className={`text-sm font-semibold ${isNextFlight ? 'text-blue-500 dark:text-blue-400' : 'text-green-500 dark:text-green-400'}`}>
                    {isNextFlight ? '다음 비행' : '최근 비행'}
                </p>
                <div className="flex flex-col justify-center items-center flex-1">
                    <p className={`text-4xl sm:text-5xl font-bold my-2 ${isNextFlight ? 'text-blue-600 dark:text-blue-500' : 'text-green-600 dark:text-green-500'}`}>
                        {ddayInfo.text === 'D-Day' ? '오늘' : ddayInfo.text}
                    </p>
                    <div className="flex items-center justify-center">
                        <span className="text-4xl sm:text-5xl font-bold text-gray-800 dark:text-gray-200">{targetAirport}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FlightCard;
