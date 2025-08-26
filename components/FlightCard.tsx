
import React from 'react';
import { Flight } from '../types';
import { calculateDday } from '../utils/helpers';
import StatusBadge from './StatusBadge';

interface FlightCardProps {
    flight: Flight | undefined;
    type: 'last' | 'next';
    onClick: (flight: Flight) => void;
    todayStr: string;
}

const FlightCard: React.FC<FlightCardProps> = ({ flight, type, onClick, todayStr }) => {
    if (!flight) {
        return (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center flex flex-col justify-center items-center h-full">
                <p className="text-xl font-bold text-gray-400">
                    {type === 'next' ? '예정된 비행 없음' : '과거 비행 기록 없음'}
                </p>
            </div>
        );
    }

    const ddayInfo = calculateDday(flight.date, todayStr);
    const [origin, destination] = flight.route.split('/');
    const isNextFlight = type === 'next';
    const targetAirport = origin === 'ICN' ? destination : origin;

    return (
        <div 
            onClick={() => onClick(flight)} 
            className="bg-white rounded-2xl shadow-lg p-6 text-center cursor-pointer transform hover:scale-105 transition-transform duration-300 flex flex-col justify-between h-full relative"
        >
            <StatusBadge status={flight.status} />
            <div>
                <p className={`text-sm font-semibold ${isNextFlight ? 'text-blue-500' : 'text-green-500'}`}>
                    {isNextFlight ? '다음 비행' : '최근비행 현황'}
                </p>
                <p className={`text-4xl sm:text-5xl font-bold my-2 ${isNextFlight ? 'text-blue-600' : 'text-green-600'}`}>
                    {ddayInfo.text}
                </p>
            </div>
            <div className="flex items-center justify-center mt-2">
                <span className="text-4xl sm:text-5xl font-bold text-gray-800">{targetAirport}</span>
            </div>
        </div>
    );
};

export default FlightCard;
