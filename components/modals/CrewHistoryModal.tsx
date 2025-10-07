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
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-[70] p-4 pt-safe" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 dark:text-gray-300">
                    <XIcon className="w-6 h-6" />
                </button>
                
                <div className="flex-shrink-0">
                    <div className="flex items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            <span className="text-blue-600 dark:text-blue-400">{crewName}</span>님과의 비행 기록
                            {crewType === 'cabin' && (
                                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                                    (객실 승무원)
                                </span>
                            )}
                        </h2>
                        {onMemoClick && (
                            <button
                                onClick={() => onMemoClick(crewName)}
                                className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
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
                                    className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer"
                                    onClick={() => onFlightClick(flight)}
                                >
                                    <p className="font-semibold text-gray-800 dark:text-gray-200">{flight.date}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{flight.flightNumber}편: {flight.route?.replace('/', ' → ')}</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-8">함께한 비행 기록이 없습니다.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CrewHistoryModal;
