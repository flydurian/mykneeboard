import React from 'react';
import { XIcon } from '../icons';

interface NoFlightModalProps {
    isOpen: boolean;
    type: 'next' | 'last' | 'nextNext';
    onClose: () => void;
}

const NoFlightModal: React.FC<NoFlightModalProps> = ({ isOpen, type, onClose }) => {
    if (!isOpen) return null;

    const title = type === 'last' ? '최근 비행' : type === 'next' ? '다음 비행' : '그 다음 비행';
    const message = type === 'last' ? '과거 비행 기록이 없습니다.' : type === 'next' ? '다음 비행 스케줄이 없습니다.' : '그 다음 비행 스케줄이 없습니다.';

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 pt-safe" onClick={onClose}>
            <div className="glass-panel rounded-2xl shadow-xl w-full max-w-md p-6 relative animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold text-white mb-4">{title} 정보</h2>
                <p className="text-slate-400">{message}</p>
            </div>
        </div>
    );
};

export default NoFlightModal;
