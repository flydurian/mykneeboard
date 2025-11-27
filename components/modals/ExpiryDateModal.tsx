import React, { useState, useEffect } from 'react';
import { XIcon } from '../icons';
import CustomDatePicker from '../CustomDatePicker';

interface ExpiryDateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (expiryDate: string) => void;
    cardType: string;
    cardName: string;
    currentExpiryDate?: string;
    theme?: string;
}

const ExpiryDateModal: React.FC<ExpiryDateModalProps> = ({
    isOpen,
    onClose,
    onSave,
    cardType,
    cardName,
    currentExpiryDate,
    theme = 'system'
}) => {
    const [expiryDate, setExpiryDate] = useState('');
    const [isValid, setIsValid] = useState(true);
    const triggerRef = React.useRef<HTMLDivElement>(null);

    // 로컬 시간대 기준으로 오늘 날짜를 YYYY-MM-DD 형식으로 반환
    const getTodayLocal = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    useEffect(() => {
        if (isOpen) {
            // 현재 만기 날짜가 있으면 설정, 없으면 오늘 날짜로 초기화
            if (currentExpiryDate) {
                setExpiryDate(currentExpiryDate);
            } else {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                setExpiryDate(`${year}-${month}-${day}`);
            }
        }
    }, [isOpen, currentExpiryDate]);

    const handleDateChange = (date: string) => {
        setExpiryDate(date);

        // 날짜 유효성 검사
        if (date) {
            const selectedDate = new Date(date);
            const today = new Date();
            today.setHours(0, 0, 0, 0); // 시간 부분 제거

            setIsValid(selectedDate >= today);
        } else {
            setIsValid(true);
        }
    };

    const handleSave = () => {
        if (expiryDate && isValid) {
            onSave(expiryDate);
            onClose();
        }
    };

    const handleClose = () => {
        setExpiryDate('');
        setIsValid(true);
        onClose();
    };

    const getCardIcon = (type: string) => {
        switch (type) {
            case 'passport':
                return (
                    <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                );
            case 'visa':
                return (
                    <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                );
            case 'epta':
                return (
                    <svg className="w-6 h-6 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                );
            case 'radio':
                return (
                    <svg className="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 12a7.971 7.971 0 00-1.343-4.243 1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                );
            case 'whitecard':
                return (
                    <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                );
            default:
                return (
                    <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                );
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-2 sm:p-4 pt-safe" onClick={handleClose}>
            <div ref={triggerRef} className="glass-panel rounded-2xl shadow-xl w-full max-w-sm sm:max-w-md p-4 sm:p-6 relative animate-fade-in-up max-h-[90vh] overflow-y-auto" style={{ height: 'auto', minHeight: '280px' }} onClick={(e) => e.stopPropagation()}>
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white"
                >
                    <XIcon className="w-5 h-5" />
                </button>

                <div className="text-center mb-3 sm:mb-4">
                    <div className="flex justify-center mb-2 sm:mb-3">
                        {getCardIcon(cardType)}
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-white mb-1">
                        {cardName} 만기일 설정
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400">
                        {cardName}의 만료일을 입력하세요.
                    </p>
                </div>

                <div className="mb-3 sm:mb-4">
                    <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">
                        만료일
                    </label>
                    <CustomDatePicker
                        value={expiryDate}
                        onChange={handleDateChange}
                        min={getTodayLocal()}
                        placeholder="만료일을 선택하세요"
                        triggerRef={triggerRef}
                        theme={theme}
                        className={`${!isValid ? 'border-red-500 focus:ring-red-500' : 'glass-input border-white/10'
                            }`}
                    />
                    {!isValid && (
                        <p className="text-red-500 text-xs sm:text-sm mt-1">
                            과거 날짜는 선택할 수 없습니다.
                        </p>
                    )}
                </div>

                <div className="flex gap-2 sm:gap-3 mt-2">
                    <button
                        onClick={handleClose}
                        className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base border border-white/20 text-slate-300 rounded-lg hover:bg-white/10 transition-colors font-medium"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!expiryDate || !isValid}
                        className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base glass-button text-white rounded-lg transition-colors font-medium"
                    >
                        저장
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExpiryDateModal;