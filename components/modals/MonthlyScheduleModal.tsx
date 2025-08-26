import React from 'react';
import { MonthlyModalData } from '../../types';
import { XIcon } from '../icons';
import { formatTime } from '../../utils/helpers';

interface MonthlyScheduleModalProps {
    data: MonthlyModalData | null;
    onClose: () => void;
}

const MonthlyScheduleModal: React.FC<MonthlyScheduleModalProps> = ({ data, onClose }) => {
    if (!data) return null;
    const { month, flights } = data;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <XIcon className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold text-gray-900 mb-4">{month + 1}월 스케줄</h2>
                <div className="max-h-[60vh] overflow-auto">
                    {flights.length > 0 ? (
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs font-semibold text-gray-800 uppercase bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 whitespace-nowrap">날짜</th>
                                    <th className="px-4 py-2 whitespace-nowrap">편명</th>
                                    <th className="px-4 py-2 whitespace-nowrap">구간</th>
                                    <th className="px-4 py-2 whitespace-nowrap">Block</th>
                                    <th className="px-4 py-2 whitespace-nowrap">이름</th>
                                    <th className="px-4 py-2 whitespace-nowrap">직급</th>
                                    <th className="px-4 py-2 whitespace-nowrap">타입</th>
                                    <th className="px-4 py-2 whitespace-nowrap">포지션</th>
                                </tr>
                            </thead>
                            <tbody>
                                {flights.map(flight => (
                                    <React.Fragment key={flight.id}>
                                        {flight.crew.map((member, index) => (
                                            <tr key={`${flight.id}-${member.empl}`} className="border-b">
                                                {index === 0 && (
                                                    <>
                                                        <td rowSpan={flight.crew.length} className="px-4 py-2 align-top font-medium text-gray-900 whitespace-nowrap">{flight.date.substring(5)}</td>
                                                        <td rowSpan={flight.crew.length} className="px-4 py-2 align-top text-gray-900 whitespace-nowrap">{flight.flightNumber}</td>
                                                        <td rowSpan={flight.crew.length} className="px-4 py-2 align-top text-gray-900 whitespace-nowrap">{flight.route.replace('/', ' → ')}</td>
                                                        <td rowSpan={flight.crew.length} className="px-4 py-2 align-top text-gray-900 whitespace-nowrap">{formatTime(flight.block)}</td>
                                                    </>
                                                )}
                                                <td className="px-4 py-2 text-gray-900 whitespace-nowrap">{member.name}</td>
                                                <td className="px-4 py-2 text-gray-900 whitespace-nowrap">{member.rank}</td>
                                                <td className="px-4 py-2 text-gray-900 whitespace-nowrap">{member.posnType}</td>
                                                <td className="px-4 py-2 text-gray-900 whitespace-nowrap">{member.posn}</td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-gray-500 text-center py-8">해당 월의 스케줄이 없습니다.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MonthlyScheduleModal;