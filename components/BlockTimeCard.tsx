
import React from 'react';
import { Flight } from '../types';
import { formatTime } from '../utils/helpers';

interface BlockTimeCardProps {
    flights: Flight[];
    todayStr: string;
    onMonthClick: (month: number, flights: Flight[]) => void;
}

const BlockTimeCard: React.FC<BlockTimeCardProps> = ({ flights, todayStr, onMonthClick }) => {
    const today = new Date(todayStr);
    const currentMonth = today.getMonth();
    const nextMonth = (currentMonth + 1) % 12;
    
    const currentMonthFlights = flights.filter(f => new Date(f.date).getMonth() === currentMonth);
    const nextMonthFlights = flights.filter(f => new Date(f.date).getMonth() === nextMonth);

    const currentMonthBlock = currentMonthFlights.reduce((sum, f) => sum + f.block, 0);
    const nextMonthBlock = nextMonthFlights.reduce((sum, f) => sum + f.block, 0);

    return (
        <div className="bg-white rounded-2xl shadow-lg p-2">
            <div className="grid grid-cols-2 gap-4 text-center">
                <div onClick={() => onMonthClick(currentMonth, currentMonthFlights)} className="py-1 rounded-lg cursor-pointer hover:bg-gray-100">
                    <p className="text-base sm:text-lg font-bold text-gray-800">{currentMonth + 1}월</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatTime(currentMonthBlock)}</p>
                </div>
                <div onClick={() => onMonthClick(nextMonth, nextMonthFlights)} className="py-1 rounded-lg cursor-pointer hover:bg-gray-100">
                    <p className="text-base sm:text-lg font-bold text-gray-800">{nextMonth + 1}월</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatTime(nextMonthBlock)}</p>
                </div>
            </div>
        </div>
    );
};

export default BlockTimeCard;
