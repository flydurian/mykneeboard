
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

    if (type === 'last') {
        // 최근 비행 카드: 인라인 모드 (중앙 정렬)
        return (
            <div key={`status-${statusKey}`} className="flex items-center justify-center gap-3 mt-1 w-full px-2 sm:px-4">
                {/* 이륙 버튼 */}
                <button
                    onClick={handleDepartureClick}
                    className="relative flex-1 py-1 flex items-center justify-center group"
                >
                    <div className={`absolute inset-0 rounded-full backdrop-blur-md border transition-all duration-300 shadow-lg ${status.departed
                        ? 'bg-blue-500/80 border-blue-400/50 shadow-blue-500/30'
                        : 'bg-slate-800/40 border-white/10 hover:bg-slate-700/50'
                        }`}
                    />
                    <span className={`relative z-10 text-xs sm:text-sm font-bold ${status.departed ? 'text-white' : 'text-slate-400'}`}>
                        <span className="md:hidden">TO</span>
                        <span className="hidden md:inline">TAKE OFF</span>
                    </span>
                </button>

                {/* 착륙 버튼 */}
                <button
                    onClick={handleLandingClick}
                    className="relative flex-1 py-1 flex items-center justify-center group"
                >
                    <div className={`absolute inset-0 rounded-full backdrop-blur-md border transition-all duration-300 shadow-lg ${status.landed
                        ? 'bg-lime-500/80 border-lime-400/50 shadow-lime-500/30'
                        : 'bg-slate-800/40 border-white/10 hover:bg-slate-700/50'
                        }`}
                    />
                    <span className={`relative z-10 text-xs sm:text-sm font-bold ${status.landed ? 'text-white' : 'text-slate-400'}`}>
                        <span className="md:hidden">LD</span>
                        <span className="hidden md:inline">LANDING</span>
                    </span>
                </button>
            </div>
        );
    }

    return (
        <>
            {/* 기본 모드: 좌우 상단 분리 배치 (absolute) */}
            <div key={`status-${statusKey}`}>
                {/* 이륙 버튼 */}
                <div className="absolute bottom-3 left-3">
                    <button
                        onClick={handleDepartureClick}
                        className="relative px-3 py-0.5 sm:py-1 flex items-center justify-center"
                    >
                        <div className={`absolute inset-0 rounded-full backdrop-blur-md border transition-all duration-300 shadow-lg ${status.departed
                            ? 'bg-blue-500/80 border-blue-400/50 shadow-blue-500/30'
                            : 'bg-slate-800/40 border-white/10 hover:bg-slate-700/50'
                            }`}
                        />
                        <span className={`relative z-10 text-xs font-bold ${status.departed ? 'text-white' : 'text-slate-400'}`}>
                            DEP
                        </span>
                    </button>
                </div>

                {/* 착륙 버튼 */}
                <div className="absolute bottom-3 right-3">
                    <button
                        onClick={handleLandingClick}
                        className="relative px-3 py-0.5 sm:py-1 flex items-center justify-center"
                    >
                        <div className={`absolute inset-0 rounded-full backdrop-blur-md border transition-all duration-300 shadow-lg ${status.landed
                            ? 'bg-lime-500/80 border-lime-400/50 shadow-lime-500/30'
                            : 'bg-slate-800/40 border-white/10 hover:bg-slate-700/50'
                            }`}
                        />
                        <span className={`relative z-10 text-xs font-bold ${status.landed ? 'text-white' : 'text-slate-400'}`}>
                            ARR
                        </span>
                    </button>
                </div>
            </div>
        </>
    );
};

export default StatusBadge;
