import React from 'react';

interface RestAlarmModalProps {
    isOpen: boolean;
    periodName: string;
    onDismiss: () => void;
}

export default function RestAlarmModal({
    isOpen,
    periodName,
    onDismiss
}: RestAlarmModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 pt-safe">
            <div className="glass-panel rounded-2xl p-6 w-full max-w-md mx-4">
                {/* 헤더 */}
                <div className="flex items-center justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mb-2">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                    </div>
                </div>

                <h2 className="text-xl font-bold text-white text-center mb-2">
                    휴식 구간 종료 알림
                </h2>

                <p className="text-slate-300 text-center mb-6">
                    <span className="font-semibold text-orange-400">{periodName}</span>이(가)<br />
                    15분 후 종료됩니다.
                </p>

                {/* 확인 버튼 */}
                <button
                    onClick={onDismiss}
                    className="w-full glass-button px-4 py-2.5 rounded-xl font-medium"
                    style={{
                        WebkitAppearance: 'none',
                        appearance: 'none',
                        borderRadius: '0.75rem'
                    }}
                >
                    확인
                </button>
            </div>
        </div>
    );
}
