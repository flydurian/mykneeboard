import React from 'react';
import { Flight } from '../../types';
import { XIcon } from '../icons';

interface FlightDetailModalProps {
    flight: Flight | null;
    onClose: () => void;
    onUpdateStatus: (flightId: number, statusToToggle: 'departed' | 'landed') => void;
}

const FlightDetailModal: React.FC<FlightDetailModalProps> = ({ flight, onClose, onUpdateStatus }) => {
    if (!flight) return null;

    const departedButtonStyle = flight.status.departed ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300';
    const landedButtonStyle = flight.status.landed ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <XIcon className="w-6 h-6" />
                </button>
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-gray-900">{flight.date} 비행 정보</h2>
                    <p className="text-gray-600">{flight.flightNumber} / {flight.route.replace('/', ' → ')}</p>
                    <p className="text-gray-600">출도착 시간: {flight.std} → {flight.sta}</p>
                </div>
                <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">FLIGHT CREW LIST</h3>
                    <div className="overflow-x-auto mb-4">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2">EMPL</th>
                                    <th className="px-4 py-2">NAME</th>
                                    <th className="px-4 py-2">RANK</th>
                                    <th className="px-4 py-2">POSN TYP</th>
                                    <th className="px-4 py-2">POSN</th>
                                </tr>
                            </thead>
                            <tbody>
                                {flight.crew.map(member => (
                                    <tr key={member.empl} className="border-b">
                                        <td className="px-4 py-2 font-medium text-gray-900">{member.empl}</td>
                                        <td className="px-4 py-2 text-gray-900">{member.name}</td>
                                        <td className="px-4 py-2 text-gray-900">{member.rank}</td>
                                        <td className="px-4 py-2 text-gray-900">{member.posnType}</td>
                                        <td className="px-4 py-2 text-gray-900">{member.posn}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">이착륙 선택</h3>
                    <div className="flex space-x-2">
                        <button onClick={() => onUpdateStatus(flight.id, 'departed')} className={`flex-1 font-bold py-2 px-4 rounded-lg transition-colors ${departedButtonStyle}`}>이륙</button>
                        <button onClick={() => onUpdateStatus(flight.id, 'landed')} className={`flex-1 font-bold py-2 px-4 rounded-lg transition-colors ${landedButtonStyle}`}>착륙</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FlightDetailModal;
