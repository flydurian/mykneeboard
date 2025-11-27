import React, { useState } from 'react';
import { Flight } from '../../types';
import { XIcon, MemoIcon } from '../icons';
import { isActualFlight } from '../../utils/helpers';

interface CrewHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    crewName: string | null;
    flightsWithCrew: Flight[];
    onFlightClick: (flight: Flight) => void;
    onMemoClick?: (crewName: string) => void;
    crewType?: 'flight' | 'cabin'; // 승무원 타입 추가
}

const CrewHistoryModal: React.FC<CrewHistoryModalProps> = ({ isOpen, onClose, crewName, flightsWithCrew, onFlightClick, onMemoClick, crewType }) => {
    if (!isOpen || !crewName) {
        return null;
    }

    // 실제 비행만 필터링하고 날짜 내림차순으로 정렬
    const sortedFlights = [...flightsWithCrew]
        .filter(isActualFlight)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[70] p-4 pt-safe" onClick={onClose}>
            <div className="glass-panel rounded-2xl shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>

                <div className="flex-shrink-0">
                    <div className="flex items-center mb-4">
                        <h2 className="text-xl font-bold text-white">
                            <span className="text-blue-400">{crewName}</span>님과의 비행 기록
                            {crewType === 'cabin' && (
                                <span className="ml-2 text-sm font-normal text-slate-400">
                                    (객실 승무원)
                                </span>
                            )}
                        </h2>
                        {onMemoClick && (
                            <button
                                onClick={() => onMemoClick(crewName)}
                                className="ml-2 p-1 text-slate-400 hover:text-white transition-colors"
                                title="메모 작성"
                            >
                                <MemoIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-grow overflow-auto">
                    {sortedFlights.length > 0 ? (
                        <ul className="space-y-3">
                            {sortedFlights.map(flight => (
                                <li
                                    key={flight.id}
                                    className="p-3 bg-black/20 rounded-lg border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                                    onClick={() => onFlightClick(flight)}
                                >
                                    <p className="font-semibold text-white">{flight.date}</p>
                                    <p className="text-sm text-slate-400">{flight.flightNumber}편: {flight.route?.replace('/', ' → ')}</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-slate-400 text-center py-8">함께한 비행 기록이 없습니다.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CrewHistoryModal;
