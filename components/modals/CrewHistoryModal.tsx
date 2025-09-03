import React from 'react';
import { Flight } from '../../types';
import { XIcon } from '../icons';

interface CrewHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    crewName: string | null;
    flightsWithCrew: Flight[];
    onFlightClick: (flight: Flight) => void;
}

const CrewHistoryModal: React.FC<CrewHistoryModalProps> = ({ isOpen, onClose, crewName, flightsWithCrew, onFlightClick }) => {
    if (!isOpen || !crewName) {
        return null;
    }

    // 날짜 내림차순으로 정렬
    const sortedFlights = [...flightsWithCrew].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[70] p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <XIcon className="w-6 h-6" />
                </button>
                
                <div className="flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                        <span className="text-blue-600 dark:text-blue-400">{crewName}</span>님과의 비행 기록
                    </h2>
                </div>
                
                <div className="flex-grow overflow-auto">
                    {sortedFlights.length > 0 ? (
                        <ul className="space-y-3">
                            {sortedFlights.map(flight => (
                                <li 
                                    key={flight.id} 
                                    className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    onClick={() => onFlightClick(flight)}
                                >
                                    <p className="font-semibold text-gray-800 dark:text-gray-200">{flight.date}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{flight.flightNumber}편: {flight.route.replace('/', ' → ')}</p>
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
