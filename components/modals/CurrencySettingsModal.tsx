import React, { useState, useRef } from 'react';
import { XIcon } from '../icons';

interface CurrencySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCards: string[];
    onCardToggle: (cardType: string) => void;
    onCardReorder: (fromIndex: number, toIndex: number) => void;
}

const CARD_OPTIONS = [
    { id: 'passport', name: '여권', description: '여권 유효기간 관리' },
    { id: 'visa', name: '비자', description: '비자 유효기간 관리' },
    { id: 'epta', name: 'EPTA', description: 'EPTA 자격 관리' },
    { id: 'radio', name: 'Radio', description: '라디오 자격 관리' },
    { id: 'whitecard', name: 'White Card', description: '화이트카드 자격 관리' }
];

const CurrencySettingsModal: React.FC<CurrencySettingsModalProps> = ({
    isOpen,
    onClose,
    selectedCards,
    onCardToggle,
    onCardReorder
}) => {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const dragRef = useRef<HTMLDivElement>(null);

    if (!isOpen) return null;

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', '');
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIndex(index);
    };

    const handleDragLeave = () => {
        setDragOverIndex(null);
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== dropIndex) {
            onCardReorder(draggedIndex, dropIndex);
        }
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 pt-safe" onClick={onClose}>
            <div className="glass-panel rounded-2xl shadow-xl w-full max-w-md p-6 relative animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>

                <div className="mb-6">
                    <h2 className="text-xl font-bold text-white mb-2">자격 현황 카드 설정</h2>
                    <p className="text-sm text-slate-400">
                        표시할 자격 현황 카드를 선택하세요.
                    </p>
                </div>

                {/* 선택된 카드들 - 드래그 앤 드롭으로 순서 변경 */}
                {selectedCards.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-sm font-medium text-slate-300 mb-3">선택된 카드 (드래그하여 순서 변경)</h3>
                        <div className="space-y-2">
                            {selectedCards.map((cardId, index) => {
                                const card = CARD_OPTIONS.find(c => c.id === cardId);
                                if (!card) return null;

                                return (
                                    <div
                                        key={cardId}
                                        ref={dragRef}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, index)}
                                        onDragEnd={handleDragEnd}
                                        className={`p-3 rounded-lg border-2 cursor-move transition-all ${draggedIndex === index
                                            ? 'border-blue-500 bg-blue-500/20 opacity-50'
                                            : dragOverIndex === index
                                                ? 'border-green-500 bg-green-500/20'
                                                : 'border-blue-500 bg-blue-500/10'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="text-gray-400">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-white">
                                                    {card.name}
                                                </h4>
                                                <p className="text-sm text-slate-400">
                                                    {card.description}
                                                </p>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onCardToggle(cardId);
                                                }}
                                                className="p-1 text-red-400 hover:text-red-300 transition-colors"
                                                title="제거"
                                            >
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 선택 가능한 카드들 */}
                <div className="space-y-3">
                    <h3 className="text-sm font-medium text-slate-300 mb-3">카드 추가</h3>
                    {CARD_OPTIONS.filter(card => !selectedCards.includes(card.id)).map((card) => (
                        <div
                            key={card.id}
                            className="p-4 rounded-lg border-2 cursor-pointer transition-all border-white/10 hover:border-white/30 bg-black/20"
                            onClick={() => onCardToggle(card.id)}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-white">
                                        {card.name}
                                    </h3>
                                    <p className="text-sm text-slate-400">
                                        {card.description}
                                    </p>
                                </div>
                                <div className="w-5 h-5 rounded border-2 border-slate-600 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end mt-6">
                    <button
                        onClick={onClose}
                        className="glass-button px-4 py-2 text-white rounded-xl transition-colors"
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CurrencySettingsModal;
