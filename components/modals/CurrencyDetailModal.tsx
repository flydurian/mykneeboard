import React from 'react';
import { CurrencyModalData } from '../../types';
import { XIcon } from '../icons';

interface CurrencyDetailModalProps {
    data: CurrencyModalData | null;
    onClose: () => void;
}

const CurrencyDetailModal: React.FC<CurrencyDetailModalProps> = ({ data, onClose }) => {
    if (!data) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <XIcon className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold text-gray-900 mb-4">{data.title} 최근 이력</h2>
                {data.events.length > 0 ? (
                    <ul className="space-y-2">
                        {data.events.slice(0, 3).map(event => (
                            <li key={event.id} className="p-4 bg-gray-50 rounded-lg">
                                <p className="font-semibold text-gray-800">{event.date}</p>
                                <p className="text-sm text-gray-600">{event.route.replace('/', ' → ')}</p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500">최근 60일 내 기록이 없습니다.</p>
                )}
            </div>
        </div>
    );
};

export default CurrencyDetailModal;