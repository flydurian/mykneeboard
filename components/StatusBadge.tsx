
import React from 'react';
import { FlightStatus } from '../types';

interface StatusBadgeProps {
    status?: FlightStatus;
    flightNumber?: string;
    isActualFlight?: boolean;
    onStatusChange?: (flightId: string, status: Partial<FlightStatus>) => void;
    flightId?: string;
    type?: 'last' | 'next';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ 
    status, 
    flightNumber, 
    isActualFlight, 
    onStatusChange, 
    flightId,
    type 
}) => {
    if (!status || !isActualFlight) return null;
    
    // 다음 비행 카드에는 버튼 표시하지 않음
    if (type === 'next') return null;
    
    // 최근 비행 카드에서만 버튼 기능 필요
    if (!onStatusChange || !flightId) return null;
    
    const handleDepartureClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onStatusChange(flightId, { departed: !status.departed });
    };
    
    const handleLandingClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onStatusChange(flightId, { landed: !status.landed });
    };
    
    // 상태 변경을 강제로 감지하기 위한 키 생성
    const statusKey = `${flightId}-${status.departed}-${status.landed}`;
    
    return (
        <>
            {/* 모바일: 좌우 상단 분리 배치 */}
            <div className="sm:hidden" key={`mobile-${statusKey}`}>
                {/* 이륙 버튼 - 항상 표시, 상태에 따라 색상 변경 */}
                <div className="absolute top-3 left-3">
                    <button
                        onClick={handleDepartureClick}
                        className={`text-xs font-bold px-2 py-1 rounded-full transition-colors cursor-pointer ${
                            status.departed 
                                ? 'bg-blue-500 text-white dark:bg-blue-600' 
                                : 'bg-white border-2 border-gray-400 text-gray-600 hover:bg-blue-100 hover:text-blue-600 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-300 dark:hover:bg-blue-900 dark:hover:text-blue-300'
                        }`}
                        title={status.departed ? "이륙 완료됨" : "이륙 완료 표시"}
                    >
                        이륙
                    </button>
                </div>
                
                {/* 착륙 버튼 - 항상 표시, 상태에 따라 색상 변경 */}
                <div className="absolute top-3 right-3">
                    <button
                        onClick={handleLandingClick}
                        className={`text-xs font-bold px-2 py-1 rounded-full transition-colors cursor-pointer ${
                            status.landed 
                                ? 'bg-green-500 text-white dark:bg-green-600' 
                                : 'bg-white border-2 border-gray-400 text-gray-600 hover:bg-green-100 hover:text-green-600 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-300 dark:hover:bg-green-900 dark:hover:text-green-300'
                        }`}
                        title={status.landed ? "착륙 완료됨" : "착륙 완료 표시"}
                    >
                        착륙
                    </button>
                </div>
            </div>
            
            {/* 태블릿 이상: 우측 상단 세로 배치 */}
            <div className="hidden sm:block absolute top-3 right-3 flex flex-col items-end" key={`desktop-${statusKey}`}>
                {/* 이륙 버튼 - 항상 표시, 상태에 따라 색상 변경 */}
                <button
                    onClick={handleDepartureClick}
                    className={`text-xs font-bold px-2 py-1 rounded-full transition-colors cursor-pointer mb-2 ${
                        status.departed 
                            ? 'bg-blue-500 text-white dark:bg-blue-600' 
                            : 'bg-white border-2 border-gray-400 text-gray-600 hover:bg-blue-100 hover:text-blue-600 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-300 dark:hover:bg-blue-900 dark:hover:text-blue-300'
                    }`}
                    title={status.departed ? "이륙 완료됨" : "이륙 완료 표시"}
                >
                    이륙
                </button>
                
                {/* 착륙 버튼 - 항상 표시, 상태에 따라 색상 변경 */}
                <button
                    onClick={handleLandingClick}
                    className={`text-xs font-bold px-2 py-1 rounded-full transition-colors cursor-pointer ${
                        status.landed 
                            ? 'bg-green-500 text-white dark:bg-green-600' 
                            : 'bg-white border-2 border-gray-400 text-gray-600 hover:bg-green-100 hover:text-green-600 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-300 dark:hover:bg-green-900 dark:hover:text-green-300'
                    }`}
                    title={status.landed ? "착륙 완료됨" : "착륙 완료 표시"}
                >
                    착륙
                </button>
            </div>
        </>
    );
};

export default StatusBadge;
