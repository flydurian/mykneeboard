import React, { useState, useRef } from 'react';
import { MonthlyModalData, Flight } from '../../types';
import { XIcon } from '../icons';

interface MonthlyScheduleModalProps {
    data: MonthlyModalData | null;
    onClose: () => void;
    onFlightClick: (flight: Flight) => void;
}

const MonthlyScheduleModal: React.FC<MonthlyScheduleModalProps> = ({ data, onClose, onFlightClick }) => {
    const [showScrollbar, setShowScrollbar] = useState(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    if (!data) {
        return null;
    }
    
    const { month, flights, blockTime } = data;

    // 현재 날짜를 기준으로 '이번 달'인지 확인하는 로직 추가
    const today = new Date();
    const currentDisplayYear = flights.length > 0 ? new Date(flights[0].date).getFullYear() : 0;
    const isCurrentMonthSchedule = today.getFullYear() === currentDisplayYear && today.getMonth() === month;

    const handleFlightClick = (flight: Flight) => {
        onFlightClick(flight);
    };

    // 스크롤 이벤트 핸들러
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setShowScrollbar(true);
        
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }
        
        scrollTimeoutRef.current = setTimeout(() => {
            setShowScrollbar(false);
        }, 1000);
    };

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg md:max-w-lg lg:max-w-lg xl:max-w-lg p-6 relative animate-fade-in-up flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <XIcon className="w-6 h-6" />
                    </button>
                    
                    <div className="flex-shrink-0">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                            {month + 1}월 스케줄
                            <span className="text-base font-medium text-gray-500 dark:text-gray-400 ml-2">
                                (총 {blockTime})
                            </span>
                        </h2>
                    </div>
                    
                    <div 
                        className={`flex-grow overflow-auto ${showScrollbar ? 'scrollbar-show' : 'scrollbar-hide'}`}
                        onScroll={handleScroll}
                    >
                        {flights.length > 0 ? (
                            <table className="text-sm text-center w-full">
                                <thead className="text-xs font-semibold text-gray-800 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 whitespace-nowrap">날짜</th>
                                        <th className="px-4 py-2 whitespace-nowrap">편명</th>
                                        <th className="px-4 py-2 whitespace-nowrap">노선</th>
                                        {/* md(768px) 이상 화면에서만 보이도록 수정 */}
                                        <th className="px-4 py-2 whitespace-nowrap hidden md:table-cell">STD</th>
                                        <th className="px-4 py-2 whitespace-nowrap hidden md:table-cell">STA</th>
                                        {isCurrentMonthSchedule && (
                                            <th className="px-4 py-2 whitespace-nowrap hidden md:table-cell">이착륙</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {flights.map(flight => (
                                        <tr 
                                            key={flight.id} 
                                            className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                                            onClick={() => handleFlightClick(flight)}
                                        >
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-200 whitespace-nowrap">
                                                {flight.date.substring(5)}
                                            </td>
                                            <td className="px-4 py-3 text-gray-900 dark:text-gray-200 max-w-[100px] break-words">
                                                {flight.flightNumber}
                                            </td>
                                            <td className="px-4 py-3 text-gray-900 dark:text-gray-200 max-w-[120px] break-words">
                                                {flight.route.replace('/', ' → ')}
                                            </td>
                                            {/* md(768px) 이상 화면에서만 보이도록 수정 */}
                                            <td className="px-4 py-3 text-gray-900 dark:text-gray-200 whitespace-nowrap hidden md:table-cell">
                                                {flight.std}
                                            </td>
                                            <td className="px-4 py-3 text-gray-900 dark:text-gray-200 whitespace-nowrap hidden md:table-cell">
                                                {flight.sta}
                                            </td>
                                            {isCurrentMonthSchedule && (
                                                <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                                                    {flight.route && (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <span title="이륙" className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${flight.status?.departed ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                                                T
                                                            </span>
                                                            <span title="착륙" className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${flight.status?.landed ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                                                L
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-8">해당 월의 스케줄이 없습니다.</p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default MonthlyScheduleModal;