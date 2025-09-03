import React from 'react';
import { XIcon } from '../icons';

interface NoFlightModalProps {
    isOpen: boolean;
    type: 'next' | 'last';
    onClose: () => void;
}

const NoFlightModal: React.FC<NoFlightModalProps> = ({ isOpen, type, onClose }) => {
    if (!isOpen) return null;

    const title = type === 'next' ? '다음 비행' : '최근 비행';
    const message = type === 'next' ? '다음 비행 스케줄이 없습니다.' : '과거 비행 기록이 없습니다.';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 relative animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <XIcon className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">{title} 정보</h2>
                <p className="text-gray-500 dark:text-gray-400">{message}</p>
            </div>
        </div>
    );
};

export default NoFlightModal;
