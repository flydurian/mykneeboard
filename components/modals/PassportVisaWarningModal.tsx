import React, { useState } from 'react';
import { XIcon } from '../icons';

interface PassportVisaWarningModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDismissForWeek: () => void;
    warnings: Array<{
        type: 'passport' | 'visa';
        name: string;
        expiryDate: string;
        daysUntilExpiry: number;
    }>;
}

const PassportVisaWarningModal: React.FC<PassportVisaWarningModalProps> = ({
    isOpen,
    onClose,
    onDismissForWeek,
    warnings
}) => {
    const [dismissForWeek, setDismissForWeek] = useState(false);

    if (!isOpen || warnings.length === 0) return null;

    const handleClose = () => {
        if (dismissForWeek) {
            onDismissForWeek();
        }
        onClose();
    };

    const getWarningIcon = (type: 'passport' | 'visa') => {
        if (type === 'passport') {
            return (
                <svg className="w-6 h-6 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
            );
        } else {
            return (
                <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
            );
        }
    };

    const getWarningMessage = (type: 'passport' | 'visa', daysUntilExpiry: number) => {
        if (type === 'passport') {
            return `여권이 ${daysUntilExpiry}일 후 만료됩니다.`;
        } else {
            return `비자가 ${daysUntilExpiry}일 후 만료됩니다.`;
        }
    };

    const getUrgencyColor = (daysUntilExpiry: number) => {
        if (daysUntilExpiry <= 30) return 'text-red-600 dark:text-red-400';
        if (daysUntilExpiry <= 90) return 'text-orange-600 dark:text-orange-400';
        return 'text-amber-600 dark:text-amber-400';
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 pt-safe" onClick={handleClose}>
            <div className="glass-panel rounded-2xl shadow-xl w-full max-w-md p-6 relative animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    <XIcon className="w-5 h-5" />
                </button>

                <div className="text-center mb-6">
                    <div className="flex justify-center mb-4">
                        <svg className="w-12 h-12 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">
                        여권/비자 만료 경고
                    </h2>
                    <p className="text-sm text-slate-400">
                        다음 문서들이 곧 만료됩니다. 미리 갱신을 준비하세요.
                    </p>
                </div>

                <div className="space-y-4 mb-6">
                    {warnings.map((warning, index) => (
                        <div
                            key={index}
                            className="p-4 rounded-lg border-2 border-amber-500/20 bg-amber-500/10"
                        >
                            <div className="flex items-start gap-3">
                                {getWarningIcon(warning.type)}
                                <div className="flex-1">
                                    <h3 className="font-semibold text-white mb-1">
                                        {warning.name}
                                    </h3>
                                    <p className={`text-sm font-medium ${getUrgencyColor(warning.daysUntilExpiry)}`}>
                                        {getWarningMessage(warning.type, warning.daysUntilExpiry)}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        만료일: {warning.expiryDate}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mb-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={dismissForWeek}
                            onChange={(e) => setDismissForWeek(e.target.checked)}
                            className="w-4 h-4 text-blue-600 bg-black/20 border-white/20 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <span className="text-sm text-slate-400">
                            1주일간 이 경고를 표시하지 않기
                        </span>
                    </label>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleClose}
                        className="flex-1 px-4 py-2 glass-button text-white rounded-xl transition-colors font-medium"
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PassportVisaWarningModal;
