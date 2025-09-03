import React from 'react';
import { CurrencyModalData, Flight } from '../../types';
import { XIcon } from '../icons';

interface CurrencyDetailModalProps {
    data: CurrencyModalData | null;
    onClose: () => void;
    onFlightClick: (flight: Flight) => void;
}

const CurrencyDetailModal: React.FC<CurrencyDetailModalProps> = ({ data, onClose, onFlightClick }) => {
    if (!data) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 relative animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <XIcon className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">{data.title} 최근 이력</h2>
                {data.events.length > 0 ? (
                    <ul className="space-y-2">
                        {data.events.slice(0, 3).map(event => (
                            <li 
                                key={event.id} 
                                className="p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                onClick={() => onFlightClick(event)}
                            >
                                <p className="font-semibold text-gray-800 dark:text-gray-200">{event.date}</p>
                                <p className="text-base text-gray-600 dark:text-gray-400">{event.flightNumber}편: {event.route.replace('/', ' → ')}</p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500 dark:text-gray-400">최근 90일 내 기록이 없습니다.</p>
                )}
            </div>
        </div>
    );
};

export default CurrencyDetailModal;