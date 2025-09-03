
import React from 'react';
import { FlightStatus } from '../types';

interface StatusBadgeProps {
    status?: FlightStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    if (!status) return null;
    
    return (
        <>
            {/* 모바일: 좌우 상단 분리 배치 */}
            <div className="sm:hidden">
                {status.departed && (
                    <div className="absolute top-3 left-3">
                        <div className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            이륙
                        </div>
                    </div>
                )}
                {status.landed && (
                    <div className="absolute top-3 right-3">
                        <div className="text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            착륙
                        </div>
                    </div>
                )}
            </div>
            
            {/* 태블릿 이상: 우측 상단 세로 배치 */}
            <div className="hidden sm:block absolute top-3 right-3 flex flex-col items-end">
                {status.departed && (
                    <div className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mb-2">
                        이륙
                    </div>
                )}
                {status.landed && (
                    <div className="text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        착륙
                    </div>
                )}
            </div>
        </>
    );
};

export default StatusBadge;
