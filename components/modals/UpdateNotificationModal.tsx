import React from 'react';

interface UpdateNotificationModalProps {
    isOpen: boolean;
    onUpdate: () => void;
    onDismiss: () => void;
}

export default function UpdateNotificationModal({
    isOpen,
    onUpdate,
    onDismiss
}: UpdateNotificationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 pt-safe">
            <div className="glass-panel rounded-2xl p-6 w-full max-w-md mx-4">
                {/* 헤더 */}
                <div className="flex items-center justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-2">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </div>
                </div>

                <h2 className="text-xl font-bold text-white text-center mb-2">
                    새 버전 업데이트
                </h2>

                <p className="text-slate-300 text-center mb-6">
                    My KneeBoard의 새 버전이 준비되었습니다.<br />
                    지금 업데이트하여 최신 기능을 사용하세요.
                </p>

                {/* 버튼들 */}
                <div className="flex gap-3">
                    <button
                        onClick={onDismiss}
                        className="flex-1 px-4 py-2.5 text-slate-300 hover:text-white transition-colors rounded-xl border border-white/10 hover:border-white/20"
                    >
                        나중에
                    </button>
                    <button
                        onClick={onUpdate}
                        className="flex-1 glass-button px-4 py-2.5 rounded-xl font-medium"
                        style={{
                            WebkitAppearance: 'none',
                            appearance: 'none',
                            borderRadius: '0.75rem'
                        }}
                    >
                        지금 업데이트
                    </button>
                </div>
            </div>
        </div>
    );
}
